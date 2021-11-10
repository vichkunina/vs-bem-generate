import { LANGUAGES } from "./constants";

export type Snippet = {
    [key in LANGUAGES]: {
        [key: string]: {
            prefix: string[];
            body: string[];
            description: string;
        }
    };
};