declare module "qrcode-js" {
    declare const typeNumber: number;
    declare const errorCorrectLevel: string;
    declare function toBase64(text: string, size: number): string;
    declare function toDataURL(text: string, size: number): string;
}
