/**
 * Minimal GitHub Contents API client for committing data/events.json changes
 * from functions/api/admin/events.ts. Uses the sha-based optimistic
 * concurrency the Contents API already provides: a PUT with a stale `sha`
 * is rejected by GitHub with 409/422 rather than silently overwriting a
 * concurrent edit.
 */

const GITHUB_API = 'https://api.github.com'

export class GitHubConflictError extends Error {
  constructor() {
    super('Someone else just edited this file — refresh and try again.')
    this.name = 'GitHubConflictError'
  }
}

type ContentsResponse = { content: string; sha: string }

export async function getJSONFile<T>(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<{ data: T; sha: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'section-j-admin',
    },
  })
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`)
  const body = (await res.json()) as ContentsResponse
  const data = JSON.parse(atob(body.content.replace(/\n/g, ''))) as T
  return { data, sha: body.sha }
}

export async function putJSONFile(
  owner: string,
  repo: string,
  path: string,
  data: unknown,
  sha: string,
  token: string,
  message: string,
): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n'
  const encoded = btoa(unescape(encodeURIComponent(content)))

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'section-j-admin',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: encoded,
      sha,
      committer: { name: 'Section J Admin', email: 'noreply@users.noreply.github.com' },
    }),
  })

  if (res.status === 409 || res.status === 422) throw new GitHubConflictError()
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status}`)
}

export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowFile: string,
  ref: string,
  token: string,
): Promise<void> {
  await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'section-j-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
    },
  )
  // Best-effort: a rebuild is a durability nicety here, not something the
  // admin write should fail over. KV already serves the change live.
}
