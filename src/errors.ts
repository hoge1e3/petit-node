export function ex(type:string|object, base:string):Error;
export function ex<E extends Error>(type:string|object, base:E):E;
export function ex<E extends Error=Error>(type:string|object, base:string|E): Error{
    if(typeof base==="string"){
        return ex(type, new Error(base));
    }
    const opt:object=typeof type==="string"?{type}:type;
    return Object.assign(base,opt);
}