import { Diagnostic, DiagnosticCategory } from 'typescript'
import { issueCommand } from '@actions/core/lib/command'
import { getOctokit, context } from '@actions/github'
import { getInput } from '@actions/core'

type TS = typeof import('typescript')

export const reporter = (ts:TS) => (diagnostic:Diagnostic) => {
  switch (diagnostic.category) {
    case ts.DiagnosticCategory.Error: {
      // return issueCommand('error', readProperties(diagnostic), ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    }
    case ts.DiagnosticCategory.Warning: {
      // return issueCommand('warning', readProperties(diagnostic), ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    }
  }
}

export const readProperties = ({ start, file }:Diagnostic) => {
  const fileName = file && file.fileName
  if (!fileName) return {}
  if (!start) return { file: fileName }

  const content = file!.getFullText()
  const { line, column } = parseLocation(content, start)
  return { file: fileName, line: `${line}`, col: `${column}` }
}

export const parseLocation = (content:string, position:number) => {
  let l = 1
  let c = 0
  for (let i = 0; i < content.length && i < position; i++) {
    const cc = content[i]
    if (cc === '\n') {
      c = 0
      l++
    } else {
      c++
    }
  }

  return { line: l, column: c };
}

export const uploader = (ts: TS) => async (diagnostics: Diagnostic[]) => {
  try {
    const repoToken = getInput('repo_token', { required: false })
    if (repoToken) {
      const octokit = getOctokit(repoToken)
      const pullRequest = context.payload.pull_request
      let ref
      if (pullRequest) {
        ref = pullRequest.head.sha
      } else {
        ref = context.sha
      }
      const { owner, repo } = context.repo

      const { data: { id: checkRunId } } = await octokit.checks.create({
        owner,
        repo,
        name: "Update TypeScript error annotations",
        head_sha: ref,
        status: 'in_progress'
      })

      // The GitHub API requires that annotations are submitted in batches of 50 elements maximum
      const batchedAnnotations = batch(50, diagnostics)
      for (const batch of batchedAnnotations) {
        const annotations = batch.map(diagnostic => {
          const { line, file = "" } = readProperties(diagnostic)
          return {
            path: file.replace(
              `${process.env.RUNNER_WORKSPACE as string}/${repo}/`,
              ''
            ),
            start_line: Number(line),
            end_line: Number(line),
            annotation_level: getAnnotationLevel(diagnostic),
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          }
        })

        octokit.checks.update({
          owner,
          repo,
          check_run_id: checkRunId,
          status: 'completed',
          conclusion: 'success',
          output: {
            title: "TypeScript errors",
            summary:`Found ${diagnostics.length} TypeScript errors`,
            annotations,
          }
        }).catch(err => {
          console.log("upload fetch err", err)
        })
      }
    }
  } catch (error) {
    console.log("error uploading annotations", error)
  }
}

function batch<T>(size: number, inputs: T[]) {
  return inputs.reduce((batches, input) => {
    const current = batches[batches.length - 1]

    current.push(input)

    if (current.length === size) {
      batches.push([])
    }

    return batches
  }, [[]] as T[][])
}

const getAnnotationLevel = (diagnostic: Diagnostic) => {
  switch (diagnostic.category) {
    case DiagnosticCategory.Error:
      return "failure"
    case DiagnosticCategory.Warning:
      return "warning"
    default:
      return "notice"
  }
}
