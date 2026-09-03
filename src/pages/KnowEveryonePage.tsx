import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSectionData } from '../gate/SectionData'
import { PersonPhoto } from '../components/PersonPhoto'
import { currentRoleLabel } from '../lib/people'
import { mulberry32 } from '../lib/pairing'
import type { Person } from '../lib/types'

const PROGRESS_KEY = 'section-j.quiz'
const SESSION_LENGTH = 10
const CHOICES = 4

type Mode = 'photo-to-name' | 'name-to-photo'

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

type Question = {
  answer: Person
  options: Person[]
}

/**
 * Weighted sample without replacement. Weight halves with each Leitner box, so an
 * unseen person is 32× more likely to come up than one you have answered
 * correctly five times running.
 */
function pickQuestionPeople(
  people: Person[],
  progress: Progress,
  count: number,
  random: () => number,
): Person[] {
  const pool = people.filter((p) => p.photoId)
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
 * learn the section, not to build a hard adversarial test.
 */
function buildQuestion(answer: Person, people: Person[], random: () => number): Question {
  const others = people.filter((p) => p.id !== answer.id)
  const distractors: Person[] = []
  const used = new Set<string>()

  while (distractors.length < CHOICES - 1 && distractors.length < others.length) {
    const candidate = others[Math.floor(random() * others.length)]
    if (used.has(candidate.id)) continue
    used.add(candidate.id)
    distractors.push(candidate)
  }

  const options = [answer, ...distractors]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return { answer, options }
}

export function KnowEveryonePage() {
  const { people, byId } = useSectionData()
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [mode, setMode] = useState<Mode>('photo-to-name')
  const [seed, setSeed] = useState(() => Date.now() & 0xffff)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)

  const questions = useMemo(() => {
    const random = mulberry32(seed)
    const subjects = pickQuestionPeople(people, progress, SESSION_LENGTH, random)
    return subjects.map((subject) => buildQuestion(subject, people, random))
    // `progress` is intentionally omitted: re-weighting mid-session would rebuild
    // the question list under the player's feet after every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, seed])

  const question = questions[index]
  const finished = index >= questions.length

  const answer = useCallback(
    (choiceId: string) => {
      if (picked || !question) return
      setPicked(choiceId)

      const correct = choiceId === question.answer.id
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
      if (n >= 1 && n <= question.options.length) answer(question.options[n - 1].id)
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

  const trouble = useMemo(
    () =>
      Object.entries(progress)
        .filter(([, entry]) => entry.wrong > 0 && entry.box <= 1)
        .sort((a, b) => b[1].wrong - a[1].wrong)
        .slice(0, 12)
        .map(([id, entry]) => ({ person: byId.get(id), wrong: entry.wrong }))
        .filter((row): row is { person: Person; wrong: number } => Boolean(row.person)),
    [progress, byId],
  )

  const learned = Object.values(progress).filter((entry) => entry.box >= 3).length
  const withPhotos = people.filter((p) => p.photoId).length

  if (withPhotos < CHOICES) {
    return (
      <p className="py-16 text-center text-sm text-ink-400">
        The quiz needs at least {CHOICES} people with photos. Run the photo pipeline first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-ink-300 dark:border-ink-700">
          {(
            [
              ['photo-to-name', 'Photo → name'],
              ['name-to-photo', 'Name → photo'],
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
                mode === value ? 'bg-crimson-600 text-white' : 'text-ink-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-sm text-ink-500">
          <span className="font-serif text-2xl text-crimson-600">{learned}</span>
          <span className="text-ink-400">/{withPhotos} learned</span>
        </p>
      </div>

      {finished ? (
        <div className="card p-8 text-center">
          <p className="font-serif text-4xl text-crimson-600">
            {score}/{questions.length}
          </p>
          <p className="mt-2 text-sm text-ink-500">
            {score === questions.length
              ? 'Perfect round.'
              : 'The ones you missed will come back sooner.'}
          </p>
          <button
            onClick={restart}
            className="mt-5 rounded-lg bg-crimson-600 px-5 py-2.5 text-sm text-white hover:bg-crimson-700"
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

            {mode === 'photo-to-name' ? (
              <div className="flex flex-col items-center gap-4 p-6">
                <PersonPhoto
                  person={question.answer}
                  className="size-56 rounded-xl text-6xl"
                />
                <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                  {question.options.map((option, i) => (
                    <ChoiceButton
                      key={option.id}
                      label={option.displayName}
                      hint={`${i + 1}`}
                      state={
                        !picked
                          ? 'idle'
                          : option.id === question.answer.id
                            ? 'correct'
                            : option.id === picked
                              ? 'wrong'
                              : 'idle'
                      }
                      onClick={() => answer(option.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-6">
                <p className="font-serif text-3xl">{question.answer.displayName}</p>
                {currentRoleLabel(question.answer) && (
                  <p className="-mt-2 text-xs text-ink-400">{currentRoleLabel(question.answer)}</p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {question.options.map((option, i) => {
                    const state = !picked
                      ? 'idle'
                      : option.id === question.answer.id
                        ? 'correct'
                        : option.id === picked
                          ? 'wrong'
                          : 'idle'
                    return (
                      <button
                        key={option.id}
                        onClick={() => answer(option.id)}
                        className={`relative overflow-hidden rounded-xl border-4 transition ${
                          state === 'correct'
                            ? 'border-emerald-500'
                            : state === 'wrong'
                              ? 'border-crimson-600'
                              : 'border-transparent hover:border-ink-300'
                        }`}
                      >
                        <PersonPhoto person={option} className="size-32 text-3xl" />
                        <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 text-xs text-white">
                          {i + 1}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {picked && (
              <div className="flex items-center justify-between gap-3 border-t border-ink-200 px-4 py-3 dark:border-ink-800">
                <Link
                  to={`/directory/${question.answer.id}`}
                  className="text-sm text-ink-500 underline underline-offset-2 hover:text-crimson-600"
                >
                  See {question.answer.firstName}’s profile
                </Link>
                <button
                  onClick={next}
                  autoFocus
                  className="rounded-lg bg-crimson-600 px-4 py-2 text-sm text-white hover:bg-crimson-700"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )
      )}

      {trouble.length > 0 && (
        <section>
          <h2 className="mb-2 font-serif text-xl">People you keep missing</h2>
          <ul className="flex flex-wrap gap-2">
            {trouble.map(({ person, wrong }) => (
              <li key={person.id}>
                <Link
                  to={`/directory/${person.id}`}
                  className="flex items-center gap-2 rounded-full border border-ink-200 py-1 pl-1 pr-3 text-sm hover:border-crimson-400 dark:border-ink-800"
                >
                  <PersonPhoto person={person} className="size-7 rounded-full text-[10px]" />
                  {person.displayName}
                  <span className="text-xs text-ink-400">×{wrong}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
    idle: 'border-ink-300 hover:border-crimson-400 dark:border-ink-700',
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
