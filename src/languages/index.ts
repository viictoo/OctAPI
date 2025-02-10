import extractExpressRoutes from "./express";
import * as vscode from "vscode";
import extractNestJSRoutes from "./nestjs";

const frameworks = [
    {
        name: 'express',
        function: extractExpressRoutes
    },
    {
        name: 'nestjs',
        function: extractNestJSRoutes
    }
]

export default function frameworkMiddleware() {
    const config = vscode.workspace.getConfiguration("apiMan");
    const frameworkName = config.get<string>("framework", "express");

    const framework = frameworks.find(f => f.name === frameworkName);

    if (framework) {
        console.log(`Using framework ${frameworkName}`);
        return framework.function();
    } else {
        console.log(`Framework ${frameworkName} is not supported.`);
        vscode.window.showErrorMessage(`Framework ${frameworkName} is not supported.`);
        return [];
    }
}