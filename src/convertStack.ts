import {parse} from "stack-trace";

export function convertStack2(e:Error) {
    const r=parse(e);
    return r.map( (trace)=>{
        const fileName=trace.getFileName();
        const columnNumber=trace.getColumnNumber();
        const lineNumber=trace.getLineNumber();
        return {
            fileName, columnNumber, lineNumber
        };
    });
}