/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'

import {
  workspace,
  type ExtensionContext,
  window,
  commands,
  languages,
  // TabInputText,
  Uri
} from 'coc.nvim'

import {
  LanguageClient,
  type LanguageClientOptions,
  TransportKind,
  type ServerOptions
} from 'coc.nvim'
// import { middlewareProvideCompletion } from './middlewareCompletion'
// import { middlewareProvideHover } from './middlewareHover'
import { requestsManager } from './RequestManager'
// import { middlewareProvideDefinition } from './middlewareDefinition'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { logger } from '../lib/src/utils/OutputLogger'
import { NotificationMethod, type NotificationParams } from '../lib/src/types/notifications'
// import { updateDiagnostics } from './diagnosticsSupport'
// import { getLanguageConfiguration } from './languageConfiguration'
// import { BitbakeCodeActionProvider } from './codeActionProvider'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import * as vscode from 'coc.nvim'
// import { middlewareProvideReferences } from './middlewareReferences'

export async function activateLanguageServer (context: ExtensionContext, bitBakeProjectScanner: BitBakeProjectScanner): Promise<LanguageClient> {
  const serverModule = path.join(__dirname, 'server.js')
  // The debug options for the server
  // Use --inspect-brk instead of --inspect if you want to debug the server startup code
  const debugOptions = { execArgv: ['--nolazy', '--inspect=localhost:6010'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  }

  const sendSettings = async (): Promise<void> => {
    const settings = workspace.getConfiguration()
    await client.sendNotification('workspace/didChangeConfiguration', { settings })
  }

  workspace.onDidChangeConfiguration(sendSettings)

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for bitbake documents
    // TODO: check new documentSelector
    documentSelector: [{ scheme: 'file', language: 'bitbake' }],
  }

  // languages.setLanguageConfiguration('bitbake', getLanguageConfiguration())
  //
  // languages.onDidChangeDiagnostics(e => {
  //   e.uris.forEach(uri => {
  //     void updateDiagnostics(uri)
  //   })
  // })
  //
  // context.subscriptions.push(
  //   languages.registerCodeActionsProvider('bitbake', new BitbakeCodeActionProvider())
  // )
  //
  // if (context.storageUri?.fsPath === undefined) {
  //   logger.error('Failed to get storage path')
  // } else {
  //   await embeddedLanguageDocsManager.setStoragePath(context.storageUri.fsPath)
  // }

  // Create the language client and start the client.
  const client: LanguageClient = new LanguageClient('bitbake', 'Bitbake Language Server', serverOptions, clientOptions)
  requestsManager.client = client

  client.onRequest('bitbake/verifyConfigurationFileAssociation', async (param) => {
    if (param.filePath?.endsWith('.conf') === true) {
      const doc = await workspace.openTextDocument(param.filePath)
      const { languageId } = doc
      //  The modifications from other extensions may happen later than this handler, hence the setTimeOut
      setTimeout(() => {
        if (languageId !== 'bitbake') {
          void window.showErrorMessage(`Failed to associate this file (${param.filePath}) with BitBake Language mode. Current language mode: ${languageId}. Please make sure there is no other extension that is causing the conflict. (e.g. Txt Syntax)`)
        }
      }, 1000)
    }
  })

  client.onRequest('bitbake/parseAllRecipes', async () => {
    await commands.executeCommand('bitbake.parse-recipes')
  })

  client.onRequest('bitbake/scanRecipe', async (param) => {
    if (typeof param.uri === 'string') {
      await commands.executeCommand('bitbake.scan-recipe-env', Uri.parse(param.uri))
    } else {
      logger.error(`[OnRequest] <bitbake/scanRecipe>: Invalid uri: ${JSON.stringify(param.uri)}`)
    }
  })

  client.onRequest('bitbake/resolveContainerPath', async (uri) => {
    return await bitBakeProjectScanner.resolveContainerPath(uri, true)
  })

  client.onNotification(NotificationMethod.EmbeddedLanguageDocs, (embeddedLanguageDocs: NotificationParams['EmbeddedLanguageDocs']) => {
    void embeddedLanguageDocsManager.saveEmbeddedLanguageDocs(embeddedLanguageDocs)
  })

  // window.tabGroups.onDidChangeTabs((event) => {
  //   [...event.opened, ...event.changed].forEach((tab) => {
  //     if (tab.input instanceof TabInputText) {
  //       const uri = tab.input.uri
  //       if (embeddedLanguageDocsManager.embeddedLanguageDocsFolder === undefined) {
  //         return
  //       }
  //       // Close embedded document tabs when they open automatically
  //       if (uri.fsPath.includes(embeddedLanguageDocsManager.embeddedLanguageDocsFolder)) {
  //         if (
  //           // Prevent prompt to appear on unsaved files
  //           !tab.isDirty &&
  //           // Make possible to open embedded documents in a tab
  //           !tab.isPreview && !tab.isActive && !tab.isPinned
  //         ) {
  //           void window.tabGroups.close(tab, false)
  //         }
  //       }
  //     }
  //   })
  // })

  // Start the client and launch the server
  await client.start()
  await sendSettings()

  return client
}

export async function deactivateLanguageServer (client: LanguageClient): Promise<void> {
  await Promise.all([
    embeddedLanguageDocsManager.deleteEmbeddedLanguageDocsFolder(),
    client.stop()
  ])
}

export async function getScanResult<
  MethodName extends string,
  ParamsType extends { recipe: string },
  ReturnType
> (
  client: LanguageClient,
  methodName: MethodName,
  params: ParamsType,
  canTriggerScan: boolean = false
): Promise<ReturnType | undefined> {
  let value: ReturnType = await client.sendRequest(methodName, params)
  if ((value === undefined || value === null) && canTriggerScan) {
    // We may not have scanned the recipe yet. Let's try again.
    const progressOptions: vscode.ProgressOptions = {
      // location: vscode.ProgressLocation.Notification,
      title: `Recipe ${params.recipe} has not been scanned yet. Scanning now...`,
      cancellable: false
    }
    await vscode.window.withProgress(progressOptions, async (progress) => {
      await vscode.commands.executeCommand('bitbake.scan-recipe-env', params.recipe)
      progress.report({ increment: 100 })
    })
    value = await client.sendRequest(methodName, params)
  }
  logger.debug(`[getScanResult] (${methodName}): ${JSON.stringify(params)}, ${JSON.stringify(value)}`)
  return value ?? undefined
}

export async function getVariableValue (
  client: LanguageClient,
  variable: string, recipe: string,
  canTriggerScan: boolean = false
): Promise<string | undefined> {
  return await getScanResult(client, 'bitbake/getVar', { variable, recipe }, canTriggerScan)
}

export async function getAllVariableValues (
  client: LanguageClient,
  recipe: string,
  canTriggerScan: boolean = false
): Promise<Array<{ name: string, value: string }> | undefined> {
  return await getScanResult(client, 'bitbake/getAllVar', { recipe }, canTriggerScan)
}
