import { resolve } from "path";

// export default values
export const DEFAULT_DELIMITER = "\\wnn";
export const MAX_ROW_PROCESSED = 100;

// export default regex values
export const REGEX_CATEGORY = new RegExp(/\S*[\\\/][\d\w\-]*/gi);
export const REGEX_CLASS = new RegExp(/^[\w-_]+$/gi);
export const REGEX_NUMBER = new RegExp(/[^0-9,\.\-\+]+/gi);

// export file type mappings
const FIELD_TYPE_MAPPING = [
    { id: 5, type: "float", label: "number" },
    { id: 4, type: "datetime", label: "datetime" },
    { id: 3, type: "string_v", label: "category" },
    { id: 2, type: "string", label: "class" },
    { id: 1, type: "string", label: "text" },
];

export const ID2TYPE: { [key: number]: string } = {};
export const TYPE2ID: { [key: string]: number } = {};

export const LABEL2ID: { [key: string]: number } = {};
export const ID2LABEL: { [key: number]: string } = {};

for (const tm of FIELD_TYPE_MAPPING) {
    ID2TYPE[tm.id] = tm.type;
    TYPE2ID[tm.type] = tm.id;
    ID2LABEL[tm.id] = tm.label;
    LABEL2ID[tm.label] = tm.id;
}

export const DATA_PATH = resolve(__dirname, "..", "..", "data");
export const TMP_DOWNLOAD_PATH = resolve(__dirname, "..", "..", "tmp", "download");
