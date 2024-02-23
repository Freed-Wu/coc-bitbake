/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitbakeSettings } from '../lib/src/BitbakeSettings'
import assert from 'assert'

export class BitbakeConfigPicker {
  readonly statusBarItem: vscode.StatusBarItem
  private bitbakeSettings: BitbakeSettings
  private readonly memento: vscode.Memento | undefined
  private _activeBuildConfiguration: string = 'No BitBake configuration'

  public get activeBuildConfiguration (): string {
    return this._activeBuildConfiguration
  }

  private async updateActiveBuildConfiguration (value: string): Promise<void> {
    this._activeBuildConfiguration = value
    await this.memento?.update('BitbakeConfigPicker.activeBuildConfiguration', value)
  }

  constructor (bitbakeSettings: BitbakeSettings, context: vscode.ExtensionContext) {
    this.bitbakeSettings = bitbakeSettings
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0)
    this.memento = context.workspaceState
    this._activeBuildConfiguration = this.memento?.get('BitbakeConfigPicker.activeBuildConfiguration', 'No BitBake configuration') as string

    this.statusBarItem.command = 'bitbake.pick-configuration'
    context.subscriptions.push(vscode.commands.registerCommand('bitbake.pick-configuration', this.pickConfiguration, this))
    this.updateStatusBar(bitbakeSettings)
  }

  updateStatusBar (bitbakeSettings: BitbakeSettings): void {
    this.bitbakeSettings = bitbakeSettings
    if (this.bitbakeSettings?.buildConfigurations !== undefined && this.bitbakeSettings?.buildConfigurations?.length > 0) {
      if (this.bitbakeSettings?.buildConfigurations.find((config) => config.name === this.activeBuildConfiguration) === undefined) {
        assert(this.bitbakeSettings.buildConfigurations[0].name !== undefined) // Cannot happen with the definition in client/package.json
        // No need to update the memento here, the same default choice will be selected next time
        this._activeBuildConfiguration = this.bitbakeSettings.buildConfigurations[0].name
      }
      this.statusBarItem.text = '$(list-selection) ' + this.activeBuildConfiguration
      this.statusBarItem.show()
    } else {
      this._activeBuildConfiguration = '$(list-selection) ' + 'No BitBake configuration'
      this.statusBarItem.hide()
    }
  }

  public async pickConfiguration (name?: string): Promise<void> {
    if (this.bitbakeSettings?.buildConfigurations !== undefined && this.bitbakeSettings?.buildConfigurations?.length > 0) {
      if (name !== undefined && this.bitbakeSettings.buildConfigurations.find((config) => config.name === name) !== undefined) {
        await this.updateActiveBuildConfiguration(name)
      } else {
        const options = this.bitbakeSettings.buildConfigurations.map((config) => config.name)
        const filteredOptions = options.filter((option) => typeof option === 'string') as string[] // Always all according to the definition in client/package.json
        const selection = await vscode.window.showQuickPick(filteredOptions, { placeHolder: 'Select a BitBake configuration' })
        if (selection !== undefined) {
          await this.updateActiveBuildConfiguration(selection)
          this.updateStatusBar(this.bitbakeSettings)
        }
      }
    }
  }
}
