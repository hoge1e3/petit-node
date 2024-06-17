
export class Index<K,E> {
    map=new Map<K,E>;
    constructor(public keyOf:(key:E)=>K) {
    }
    add(item:E) {
        this.map.set(this.keyOf(item),item);
    }
    delete(item:E) {
        this.map.delete(this.keyOf(item));
    }
    get(key: K) {
        return this.map.get(key);
    }
    [Symbol.iterator]() {
        return this.map[Symbol.iterator]();
    }
}
export class MultiIndexMap<E> {
    items=new Set<E>();
    index=new Set<Index<any, E>>;
    newIndex<K>(keyOf:(item:E)=>K) {
        const idx=new Index(keyOf);
        this.index.add(idx);
        for (let item of this.items) {
            idx.add(item);
        }
        return idx;
    } 
    add(item:E) {
        if (this.has(item)) return item;
        this.items.add(item);
        for (let idx of this.index) {
            idx.add(item);
        }
        return item;
    }
    has(item:E) {
        return this.items.has(item);
    }
    delete(item:E) {
        if (!this.has(item)) return item;
        for (let idx of this.index) {
            idx.delete(item);
        }
        return item;
    }
    update(item:E, changer:(old:E)=>E) {
        this.delete(item);
        const newItem=changer(item)||item;
        this.add(newItem);
    }
    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
}