import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSectionData } from '../gate/SectionData'
import { PersonPhoto } from '../components/PersonPhoto'
import { PersonDetail } from '../components/PersonDetail'
import { currentRoleLabel, regionLabel } from '../lib/people'
import { mulberry32 } from '../lib/pairing'
import type { Person } from '../lib/types'

const PROGRESS_KEY = 'section-j.quiz'
const SESSION_LENGTH = 10
const CHOICES = 4

type Mode = 'photo-to-name' | 'name-to-photo' | 'name-to-region' | 'name-to-org'

const VALUE_MODES = ['name-to-region', 'name-to-org'] as const
type ValueMode = (typeof VALUE_MODES)[number]

function isValueMode(mode: Mode): mode is ValueMode {
  return (VALUE_MODES as readonly Mode[]).includes(mode)
}

/** The fact a value-mode question is testing, or undefined if the person never filled it in. */
function valueOf(mode: ValueMode, person: Person): string | undefined {
  return mode === 'name-to-region' ? regionLabel(person.homeRegion) : person.preMBA[0]?.company
}

const VALUE_MODE_PROMPT: Record<ValueMode, string> = {
  'name-to-region': 'Where are they from?',
  'name-to-org': 'Which organization did they work at?',
}

/**
 * Leitner-style progress, one box per person.
 *
 * Box 0 is "never seen", and every correct answer promotes a person one box while
 * a wrong answer drops them straight back to box 0. Sampling weight falls off
 * sharply with box number, so the quiz spends its time on the faces you keep
 * getting wrong instead of the five people you already know.
 */
type Progress = Record<string, { box: number; seen: number; wrong: number }>

const MAX_BOX = 5

function loadProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as Progress
  } catch {
    return {}
  }
}

function saveProgress(progress: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* storage can be disabled; the quiz still works, it just forgets */
  }
}

/**
 * `key` is what gets compared against `correctKey` and what keyboard shortcuts
 * index into — a person id for the two photo-based modes, or the value string
 * itself (a region or company name) for the two value-based modes. `person` is
 * only set for photo-based options, so `name-to-photo` can render a headshot.
 */
type Option = { key: string; label: string; person?: Person }
type Question = {
  answer: Person
  correctKey: string
  options: Option[]
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Weighted sample without replacement. Weight halves with each Leitner box, so an
 * unseen person is 32× more likely to come up than one you have answered
 * correctly five times running.
 */
function pickQuestionPeople(
  mode: Mode,
  people: Person[],
  progress: Progress,
  count: number,
  random: () => number,
): Person[] {
  const pool = isValueMode(mode)
    ? people.filter((p) => valueOf(mode, p))
    : people.filter((p) => p.photoId)
  const chosen: Person[] = []
  const weights = new Map(pool.map((p) => [p.id, 1 / 2 ** (progress[p.id]?.box ?? 0)]))

  for (let i = 0; i < count && weights.size > 0; i++) {
    const total = [...weights.values()].reduce((a, b) => a + b, 0)
    let ticket = random() * total
    for (const [id, weight] of weights) {
      ticket -= weight
      if (ticket <= 0) {
        const person = pool.find((p) => p.id === id)
        if (person) chosen.push(person)
        weights.delete(id)
        break
      }
    }
  }
  return chosen
}

/**
 * Distractors are drawn at random rather than from lookalikes — the goal is to
 * learn the section, not to build a hard adversarial test. Value-mode
 * distractors are drawn from distinct *values*, not people, so two options
 * never show the same city or employer twice.
 */
function buildQuestion(mode: Mode, answer: Person, people: Person[], random: () => number): Question {
  if (isValueMode(mode)) {
    const correctValue = valueOf(mode, answer)!
    const otherValues: string[] = []
    const seen = new Set([correctValue])
    for (const p of people) {
      const value = valueOf(mode, p)
      if (value && !seen.has(value)) {
        seen.add(value)
        otherValues.push(value)
      }
    }

    const pool = shuffle(otherValues, random)
    const distractors = pool.slice(0, CHOICES - 1)
    const options = shuffle(
      [correctValue, ...distractors].map((value) => ({ key: value, label: value })),
      random,
    )
    return { answer, correctKey: correctValue, options }
  }

  const others = people.filter((p) => p.id !== answer.id)
  const distractors: Person[] = []
  const used = new Set<string>()

  while (distractors.length < CHOICES - 1 && distractors.length < others.length) {
    const candidate = others[Math.floor(random() * others.length)]
    if (used.has(candidate.id)) continue
    used.add(candidate.id)
    distractors.push(candidate)
  }

  const options = shuffle(
    [answer, ...distractors].map((p) => ({ key: p.id, label: p.displayName, person: p })),
    random,
  )
  return { answer, correctKey: answer.id, options }
}

export function KnowEveryonePage() {
  const { people } = useSectionData()
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [mode, setMode] = useState<Mode>('photo-to-name')
  const [seed, setSeed] = useState(() => Date.now() & 0xffff)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [viewingProfile, setViewingProfile] = useState<Person | null>(null)

  const questions = useMemo(() => {
    const random = mulberry32(seed)
    const subjects = pickQuestionPeople(mode, people, progress, SESSION_LENGTH, random)
    return subjects.map((subject) => buildQuestion(mode, subject, people, random))
    // `progress` is intentionally omitted: re-weighting mid-session would rebuild
    // the question list under the player's feet after every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, seed, mode])

  const question = questions[index]
  const finished = index >= questions.length

  const answer = useCallback(
    (choiceKey: string) => {
      if (picked || !question) return
      setPicked(choiceKey)

      const correct = choiceKey === question.correctKey
      const id = question.answer.id

      setProgress((prev) => {
        const entry = prev[id] ?? { box: 0, seen: 0, wrong: 0 }
        const next: Progress = {
          ...prev,
          [id]: {
            box: correct ? Math.min(MAX_BOX, entry.box + 1) : 0,
            seen: entry.seen + 1,
            wrong: entry.wrong + (correct ? 0 : 1),
          },
        }
        saveProgress(next)
        return next
      })

      if (correct) {
        setScore((s) => s + 1)
        setStreak((s) => s + 1)
      } else {
        setStreak(0)
      }
    },
    [picked, question],
  )

  // Keys 1-4 answer, so a quick session does not need the mouse.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!question || picked) return
      const n = Number(event.key)
      if (n >= 1 && n <= question.options.length) answer(question.options[n - 1].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question, picked, answer])

  function next() {
    setPicked(null)
    setIndex((i) => i + 1)
  }

  function restart() {
    setSeed(Date.now() & 0xffff)
    setIndex(0)
    setPicked(null)
    setScore(0)
    setStreak(0)
  }

  const eligibleCount = isValueMode(mode)
    ? people.filter((p) => valueOf(mode, p)).length
    : people.filter((p) => p.photoId).length
  const shortOnData = eligibleCount < CHOICES

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap rounded-lg border border-ink-300 dark:border-ink-700">
          {(
            [
              ['photo-to-name', 'Photo → name'],
              ['name-to-photo', 'Name → photo'],
              ['name-to-region', 'Name → hometown'],
              ['name-to-org', 'Name → employer'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setMode(value)
                restart()
              }}
              aria-pressed={mode === value}
              className={`px-3 py-1.5 text-sm first:rounded-l-lg last:rounded-r-lg ${
                mode === value ? 'bg-green-600 text-white' : 'text-ink-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shortOnData ? (
        <p className="py-16 text-center text-sm text-ink-400">
          {isValueMode(mode)
            ? `Not enough people have filled in ${mode === 'name-to-region' ? 'a home region' : 'a pre-MBA employer'} yet for this mode.`
            : `The quiz needs at least ${CHOICES} people with photos. Run the photo pipeline first.`}
        </p>
      ) : finished ? (
        <div className="card p-8 text-center">
          <p className="font-serif text-4xl text-green-700 dark:text-green-400">
            {score}/{questions.length}
          </p>
          <p className="mt-2 text-sm text-ink-500">
            {score === questions.length
              ? 'Perfect round.'
              : 'The ones you missed will come back sooner.'}
          </p>
          <button
            onClick={restart}
            className="mt-5 rounded-lg bg-green-600 px-5 py-2.5 text-sm text-white hover:bg-green-700"
          >
            Another round
          </button>
        </div>
      ) : (
        question && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2 text-xs text-ink-400 dark:border-ink-800">
              <span>
                Question {index + 1} of {questions.length}
              </span>
              <span>
                {score} correct{streak >= 3 && ` · ${streak} in a row`}
              </span>
            </div>

            {mode === 'name-to-photo' ? (
              <div className="flex flex-col items-center gap-4 p-6">
                <p className="font-serif text-3xl">{question.answer.displayName}</p>
                {currentRoleLabel(question.answer) && (
                  <p className="-mt-2 text-xs text-ink-400">{currentRoleLabel(question.answer)}</p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {question.options.map((option, i) => {
                    const state = !picked
                      ? 'idle'
                      : option.key === question.correctKey
                        ? 'correct'
                        : option.key === picked
                          ? 'wrong'
                          : 'idle'
                    return (
                      <button
                        key={option.key}
                        onClick={() => answer(option.key)}
                        className={`relative overflow-hidden rounded-xl border-4 transition ${
                          state === 'correct'
                            ? 'border-emerald-500'
                            : state === 'wrong'
                              ? 'border-crimson-600'
                              : 'border-transparent hover:border-ink-300'
                        }`}
                      >
                        <PersonPhoto person={option.person!} className="size-32 text-3xl" />
                        <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 text-xs text-white">
                          {i + 1}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-6">
                {mode === 'photo-to-name' ? (
                  <PersonPhoto
                    person={question.answer}
                    className="size-56 rounded-xl text-6xl"
                  />
                ) : (
                  <>
                    <PersonPhoto
                      person={question.answer}
                      className="size-32 rounded-xl text-4xl"
                    />
                    <p className="font-serif text-3xl">{question.answer.displayName}</p>
                    <p className="-mt-2 text-sm text-ink-500">{VALUE_MODE_PROMPT[mode]}</p>
                  </>
                )}
                <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                  {question.options.map((option, i) => (
                    <ChoiceButton
                      key={option.key}
                      label={option.label}
                      hint={`${i + 1}`}
                      state={
                        !picked
                          ? 'idle'
                          : option.key === question.correctKey
                            ? 'correct'
                            : option.key === picked
                              ? 'wrong'
                              : 'idle'
                      }
                      onClick={() => answer(option.key)}
                    />
                  ))}
                </div>
              </div>
            )}

            {picked && (
              <div className="flex items-center justify-between gap-3 border-t border-ink-200 px-4 py-3 dark:border-ink-800">
                <button
                  onClick={() => setViewingProfile(question.answer)}
                  className="text-sm text-ink-500 underline underline-offset-2 hover:text-green-700 dark:hover:text-green-400"
                >
                  See {question.answer.firstName}’s profile
                </button>
                <button
                  onClick={next}
                  autoFocus
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )
      )}

      {viewingProfile && (
        <PersonDetail
          person={viewingProfile}
          onClose={() => setViewingProfile(null)}
          onNavigate={setViewingProfile}
        />
      )}
    </div>
  )
}

function ChoiceButton({
  label,
  hint,
  state,
  onClick,
}: {
  label: string
  hint: string
  state: 'idle' | 'correct' | 'wrong'
  onClick: () => void
}) {
  const styles = {
    idle: 'border-ink-300 hover:border-green-400 dark:border-ink-700',
    correct: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    wrong: 'border-crimson-600 bg-crimson-50 text-crimson-900 dark:bg-crimson-900 dark:text-crimson-100',
  }[state]

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${styles}`}
    >
      <span className="shrink-0 rounded bg-ink-100 px-1.5 text-xs text-ink-400 dark:bg-ink-800">
        {hint}
      </span>
      {label}
    </button>
  )
}
