export function to(a: Uint8Array) {
    if (!(a instanceof Uint8Array)) {
        throw new Error("argument must be an Uint8Array");
    }
    return Buffer.from(a).toString("hex");
}

export function from(s: string) {
    if (typeof s !== "string") {
        throw new Error("argument must be a string");
    }
    return Buffer.from(s, "hex");
}
