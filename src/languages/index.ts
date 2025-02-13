import extractExpressRoutes from "./express";
import * as vscode from "vscode";
import extractNestJSRoutes from "./nestjs";
import extractFastifyRoutes from "./fastify";
import extractKoaRoutes from "./koa";
import extractDjangoRoutes from "./django";

const frameworks = [
    {
        name: 'Express',
        function: extractExpressRoutes
    },
    {
        name: 'NestJS',
        function: extractNestJSRoutes
    },
    {
        name: 'fastify',
        function: extractFastifyRoutes
    },
    {
        name: 'Koa',
        function: extractKoaRoutes
    },
    {
        name: 'django',
        function: extractDjangoRoutes
    }
]

export default function frameworkMiddleware() {
    const config = vscode.workspace.getConfiguration("OctAPI");
    const frameworkName = config.get<string>("framework", "Express");

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