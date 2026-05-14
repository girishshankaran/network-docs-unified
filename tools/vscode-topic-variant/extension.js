const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const channel = vscode.window.createOutputChannel("Network Docs Topic Variant");

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("networkDocs.createTopicVariant", createTopicVariant)
  );
  context.subscriptions.push(channel);
}

function selectedUri(uri) {
  if (uri && uri.scheme === "file") return uri;
  const editor = vscode.window.activeTextEditor;
  if (editor?.document?.uri?.scheme === "file") return editor.document.uri;
  return null;
}

function workspaceFolderFor(uri) {
  return vscode.workspace.getWorkspaceFolder(uri);
}

function relativePath(workspaceFolder, uri) {
  return path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, "/");
}

function validateTopicFile(workspaceFolder, uri) {
  const relPath = relativePath(workspaceFolder, uri);
  if (!relPath.startsWith("topics/") || !relPath.endsWith(".md")) {
    throw new Error("Select a Markdown topic file under the topics/ directory.");
  }
  return relPath;
}

function nodeCommand() {
  const configured = process.env.NETWORK_DOCS_NODE_PATH;
  if (configured && fs.existsSync(configured)) return configured;

  const candidates = ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "node";
}

function runScript(workspaceFolder, command, args) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(command, args, {
      cwd: workspaceFolder.uri.fsPath,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            `Could not start Node.js at "${command}". Install Node.js or set NETWORK_DOCS_NODE_PATH to the node executable.`
          )
        );
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(stderr || stdout || `create-topic-variant exited with ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

async function promptRelease() {
  return vscode.window.showInputBox({
    title: "Create Topic Variant",
    prompt: "Release for the new topic variant",
    placeHolder: "21.0",
    validateInput(value) {
      return value.trim() ? undefined : "Release is required.";
    },
  });
}

async function promptMode() {
  const selected = await vscode.window.showQuickPick(
    [
      {
        label: "Create variant and update manifests",
        detail: "Creates the topic file, updates source lifecycle, and replaces topic IDs in target release manifests.",
        updateManifests: true,
        dryRun: false,
      },
      {
        label: "Preview only",
        detail: "Runs the same checks and prints the planned files without writing changes.",
        updateManifests: true,
        dryRun: true,
      },
      {
        label: "Create variant only",
        detail: "Creates the topic file and updates source lifecycle without touching release manifests.",
        updateManifests: false,
        dryRun: false,
      },
    ],
    {
      title: "Create Topic Variant",
      placeHolder: "Choose how to run the variant command",
    }
  );
  return selected || null;
}

async function createTopicVariant(uri) {
  try {
    const fileUri = selectedUri(uri);
    if (!fileUri) throw new Error("Select a topic file first.");

    const workspaceFolder = workspaceFolderFor(fileUri);
    if (!workspaceFolder) throw new Error("The selected file is not inside an open VS Code workspace.");

    const fromFile = validateTopicFile(workspaceFolder, fileUri);
    const release = await promptRelease();
    if (!release) return;

    const mode = await promptMode();
    if (!mode) return;

    const args = [
      "scripts/create-topic-variant.js",
      ".",
      "--from-file",
      fromFile,
      "--release",
      release.trim(),
    ];
    if (mode.updateManifests) args.push("--update-manifests");
    if (mode.dryRun) args.push("--dry-run");

    const command = nodeCommand();
    channel.clear();
    channel.appendLine(`$ ${command} ${args.join(" ")}`);
    channel.show(true);

    const result = await runScript(workspaceFolder, command, args);
    if (result.stdout) channel.append(result.stdout);
    if (result.stderr) channel.append(result.stderr);

    vscode.window.showInformationMessage(
      mode.dryRun ? "Topic variant preview completed." : "Topic variant created."
    );
  } catch (error) {
    channel.show(true);
    if (error.stdout) channel.append(error.stdout);
    if (error.stderr) channel.append(error.stderr);
    channel.appendLine(error.message);
    vscode.window.showErrorMessage(error.message);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
