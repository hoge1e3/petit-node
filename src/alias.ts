
export type ModuleValue=unknown;
export type Alias={
    url: string,
    value: ModuleValue,
};
export type Aliases={[key:string]: Alias};
export const aliases={} as Aliases;
