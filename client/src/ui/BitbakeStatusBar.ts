/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'coc.nvim'

import { type BitbakeScanResult } from '../lib/src/types/BitbakeScanResult'
// import { type BitbakeCustomExecution } from './BitbakeTaskProvider'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
// import { BitbakeRecipeScanner } from '../driver/BitbakeRecipeScanner'

export class BitbakeStatusBar {
  private bitbakeScanResults: BitbakeScanResult = { _layers: [], _classes: [], _includes: [], _recipes: [], _overrides: [], _workspaces: [], _confFiles: [] }
  private readonly bitbakeProjectScanner: BitBakeProjectScanner
  readonly statusBarItem: vscode.StatusBarItem
  private scanInProgress = false
  private parsingInProgress = false
  private recipeScanInProgress = false
  private commandInProgress: string | undefined
  private scanExitCode = 0

  constructor (bitbakeProjectScanner: BitBakeProjectScanner) {
    this.bitbakeProjectScanner = bitbakeProjectScanner
    this.statusBarItem = vscode.window.createStatusBarItem(/* vscode.StatusBarAlignment.Left,  */0)
    this.updateStatusBar()
    this.statusBarItem.show()

    this.bitbakeProjectScanner.onChange.on('scanReady', (bitbakeScanResult: BitbakeScanResult) => {
      this.scanInProgress = false
      this.bitbakeScanResults = bitbakeScanResult
      this.updateStatusBar()
    })
    this.bitbakeProjectScanner.onChange.on('startScan', () => {
      this.scanInProgress = true
      this.updateStatusBar()
    })

    this.bitbakeProjectScanner.bitbakeDriver.onBitbakeProcessChange.on('spawn', (command) => {
      this.commandInProgress = command
      this.updateStatusBar()
    })
    this.bitbakeProjectScanner.bitbakeDriver.onBitbakeProcessChange.on('close', () => {
      this.commandInProgress = undefined
      this.updateStatusBar()
    })

    // vscode.tasks.onDidStartTask((e: vscode.TaskStartEvent) => {
    //   if (e.execution.task.source !== 'bitbake') {
    //     return
    //   }
    //
    //   const taskName = e.execution.task.name
    //
    //   if (taskName === 'Bitbake: Parse') {
    //     this.parsingInProgress = true
    //   } else if (taskName === BitbakeRecipeScanner.taskName) {
    //     this.recipeScanInProgress = true
    //   }
    //
    //   this.updateStatusBar()
    // })
    // vscode.tasks.onDidEndTask((e: vscode.TaskEndEvent) => {
    //   if (e.execution.task.source !== 'bitbake') {
    //     return
    //   }
    //
    //   const taskName = e.execution.task.name
    //   this.scanExitCode = (e.execution.task.execution as BitbakeCustomExecution).pty?.lastExitCode ?? -1
    //
    //   if (taskName === 'Bitbake: Parse') {
    //     this.parsingInProgress = false
    //   } else if (taskName === BitbakeRecipeScanner.taskName) {
    //     this.recipeScanInProgress = false
    //   }
    //
    //   this.updateStatusBar()
    // })
  }

  updateStatusBar (): void {
    if (this.scanInProgress || this.parsingInProgress || this.recipeScanInProgress) {
      if (this.scanInProgress) {
        this.statusBarItem.text = '$(loading~spin) BitBake: Scanning...'
        // this.statusBarItem.tooltip = 'BitBake: Scanning...'
      } else {
        this.statusBarItem.text = '$(loading~spin) BitBake: Parsing...'
        // this.statusBarItem.tooltip = 'BitBake: Parsing...'
      }
      // this.statusBarItem.command = undefined
      // this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground')
      return
    }
    if (this.commandInProgress !== undefined) {
      let displayText = 'Building...'
      if (this.commandInProgress.includes('devtool')) displayText = 'Devtool...'
      if (this.commandInProgress.includes('which devtool')) displayText = 'Scanning...'
      if (this.commandInProgress.includes('toaster start')) displayText = 'Starting...'
      if (this.commandInProgress.includes('toaster stop')) displayText = 'Stopping...'
      this.statusBarItem.text = '$(loading~spin) BitBake: ' + displayText
      // this.statusBarItem.tooltip = 'BitBake: ' + displayText
      // this.statusBarItem.command = undefined
      // this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground')
      return
    }
    if (this.scanExitCode !== 0) {
      this.statusBarItem.text = '$(error) BitBake: Parsing error'
      // this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
      // this.statusBarItem.command = 'workbench.action.problems.focus'
      // this.statusBarItem.tooltip = 'Open problems view for more details'
    } else {
      this.statusBarItem.text = '$(library) BitBake: ' + this.bitbakeScanResults._recipes.length + ' recipes scanned'
      // this.statusBarItem.command = 'bitbake.rescan-project'
      // this.statusBarItem.tooltip = 'BitBake: Scan project for recipes'
      // this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground')
    }
  }
}
