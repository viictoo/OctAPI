export interface Route {
    method: string
    path: string
    basePath: string
    file: string
    fileLine: number
    routeId?: string
    isStarred?: boolean
}