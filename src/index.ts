import Module from 'module'
import * as path from 'path'
import * as fs from 'fs'
import { getInput, setFailed } from '@actions/core'
import { reporter, uploader } from './reporter'
import ts, { CompilerOptions, Diagnostic, DiagnosticMessageChain, ParsedCommandLine } from "typescript"

type TS = typeof import('typescript')

async function main() {
  try {
    const project = getInput('project') || 'tsconfig.json'

    const projectPath = resolveProjectPath(path.resolve(process.cwd(), project))

    if (projectPath == null) {
      throw new Error(`No valid typescript project was not found at: ${projectPath}`)
    }

    typecheck(projectPath)
  } catch (e) {
    console.error(e)
    setFailed(e)
  }
}

/**
 * Attempts to resolve ts config file and returns either path to it or `null`.
 */
const resolveProjectPath = (projectPath:string) => {
  try {
    if (fs.statSync(projectPath).isFile()) {
      return projectPath
    } else {
      const configPath = path.resolve(projectPath, "tsconfig.json")
      return fs.statSync(configPath).isFile() ? configPath : null
    }
  } catch {
    return null
  }
}

const typecheck = (projectPath:string) => {
  const ts = loadTS(projectPath)
  const json = ts.readConfigFile(projectPath, ts.sys.readFile)
  const config = ts.parseJsonConfigFileContent(
      json.config,
      ts.sys,
      path.dirname(projectPath),
      undefined,
      path.basename(projectPath)
  );

  const errors = isIncrementalCompilation(config.options)
    ? performIncrementalCompilation(ts, projectPath)
    : performCompilation(ts, config)

  const errThreshold = Number(getInput('error_fail_threshold') || 0)
  const logString = `Found ${errors} errors!`
  console.log(logString)
  if (errors > errThreshold) {
    setFailed(logString)
  }
}



const performIncrementalCompilation = (ts:TS, projectPath:string) => {

  const report = reporter(ts)
  
  const host = ts.createSolutionBuilderHost(ts.sys, undefined, report, report)
  const builder = ts.createSolutionBuilder(host, [projectPath], { noEmit: true })
  return builder.build()
}


const performCompilation = (ts: TS, config:ParsedCommandLine) => {
  const upload = uploader(ts)
  const host = ts.createCompilerHost(config.options)
  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: config.options,
    projectReferences: config.projectReferences,
    configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(config)
  })

  
  const configuration = program.getConfigFileParsingDiagnostics()
  let all:Diagnostic[] = [...program.getSyntacticDiagnostics()]
  if (all.length === 0) {
    all = [
      ...program.getOptionsDiagnostics(),
      ...program.getGlobalDiagnostics()
    ]

    if (all.length == 0) {
      all = [...program.getSemanticDiagnostics()]
    }
  }
  const diagnostics = ts.sortAndDeduplicateDiagnostics(all)

  diagnostics.forEach(d => {
    if (!d.file) {
      // not very useful without file/line info
      return
    }

    const file = d.file.fileName || "<unknown file>"
    const start = d.start || 0
    const end = start + (d.length || 0)
    const line = d.file.getLineAndCharacterOfPosition(start)

    let message: string = ""
    if (d.messageText as DiagnosticMessageChain) {
      message = (d.messageText as DiagnosticMessageChain).messageText
    } else {
      message = (d.messageText as string)
    }

    (d.relatedInformation || []).forEach(r => {
      console.warn("Related: ", r.messageText)
    })
    console.warn(`${file}:${line.line || 0}:${line.character || 0}\n${message}`)
  })

  upload(diagnostics.slice())
  return all.length
}

const isIncrementalCompilation = (options: CompilerOptions) =>
  options.incremental || options.composite

const loadTS = (projectPath:string):TS => {
  try {
    const require = Module.createRequire(projectPath)
    const ts = require('typescript')
    console.log(`Using local typescript@${ts.version}`);
    return ts
  } catch (error) {
    const ts = require('typescript')
    console.log(`Failed to find project specific typescript, falling back to bundled typescript@${ts.version}`);
    return ts
  }
}

main()
