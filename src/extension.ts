"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as dns from "dns";
import * as child_process from "child_process";
import { ExecException } from "child_process";

let openinperforceExecutable = "openinperforce.exe";
let domain;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

    // If remote schitale.vscode-perforce-teamcity-remoterun extension is installed hide extension.openinperforce.changelist.open-jira command
    vscode.commands.executeCommand('setContext', 'open-jira', !!vscode.extensions.getExtension('schitale.vscode-perforce-teamcity-remoterun'))

    if (process.platform === "win32") {
        openinperforceExecutable = path.join(
            context.extensionPath,
            openinperforceExecutable
        );
    }

    // Detect opentext intranet
    const host = await dns.promises.lookup(os.hostname(), { family: 4 });
    if (host) {
        const hostFQDNs = await dns.promises.reverse(host.address);
        if (hostFQDNs && hostFQDNs.length > 0) {
            const firstHostFQDN = hostFQDNs[0];
            if (firstHostFQDN.includes('.opentext.')) {
                domain = 'opentext.com';
            }
        }
    }

    context.subscriptions.push(vscode.commands.registerCommand("extension.openinperforce", openInPerforce));
    context.subscriptions.push(vscode.commands.registerCommand("extension.openinperforce.changelist.open-jira", openJIRA));
    context.subscriptions.push(vscode.commands.registerCommand("extension.openinperforce.resource", openInPerforceResource));
    context.subscriptions.push(vscode.commands.registerCommand("extension.openinperforce.resource.copy-depot-path", copyDepotPathResource));
}

function openJIRA(target: any) {
    if (vscode.extensions.getExtension('schitale.vscode-perforce-teamcity-remoterun')) {
        // Back off
        vscode.window.showWarningMessage('Redundant. 👋');
        return;
    }
    const changelistDescription: string = target.v?.trim();
    if (changelistDescription) {
        const config = vscode.workspace.getConfiguration("openinperforce");
        let jiraIdRegexpPattern = 'IA-\\d+';
        if (config && config.jiraIdRegexp) {
            jiraIdRegexpPattern = config.jiraIdRegexp;
        }
        const matches = new RegExp(jiraIdRegexpPattern, 'g').exec(changelistDescription);
        if (matches && matches.length > 0) {
            let jiraUrlTemplate = 'https://jira.{DOMAIN-SUFFIX}/browse/{JIRA-ID}';
            if (config && config.jiraUrlTemplate) {
                jiraUrlTemplate = config.jiraUrlTemplate;
                if (jiraUrlTemplate.includes('{DOMAIN-SUFFIX}')) {
                    if (!domain) {
                        vscode.window.showErrorMessage(`Configure the {DOMAIN-SUFFIX} and the rest in '${jiraUrlTemplate}'\ntemplate with correct DNS domain in settings to point to your JIRA.`);
                        return;
                    }
                    jiraUrlTemplate = jiraUrlTemplate.replace('{DOMAIN-SUFFIX}', domain);
                }
            }
            vscode.env.openExternal(vscode.Uri.parse(jiraUrlTemplate.replace('{JIRA-ID}', matches[0])));
        }
    }
}

function openInPerforceResource(target: any) {
    if (target.isShelved) {
        doOpenInPerforce(target.underlyingUri.fsPath);
    } else {
        doOpenInPerforce(target.resourceUri.fsPath);
    }
}

function copyDepotPathResource(target: any) {
    vscode.env.clipboard.writeText(target.depotPath);
}

function openInPerforce(uri: vscode.Uri) {
    if (uri) {
        doOpenInPerforce(uri.fsPath);
    }
}

async function doOpenInPerforce(fsPath) {
    if (!fs.existsSync(fsPath)) {
        return;
    }
    if (process.platform === 'win32') {
        // windows
        child_process.exec(`${openinperforceExecutable} ${fsPath}`, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error.code !== 0) {
                vscode.window.showErrorMessage(stderr);
            }
        });
    } else {
        // Not windows - use p4v directly
        const config = vscode.workspace.getConfiguration("openinperforce");
        let p4vcommand = "p4v";
        if (config && config.p4vcommand) {
            p4vcommand = config.p4vcommand;
        }
        child_process.exec(`${p4vcommand} -s ${fsPath}`, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error.code !== 0) {
                vscode.window.showErrorMessage(stderr);
            }
        });
    }
}

// this method is called when your extension is deactivated
export function deactivate() { }