export type Configuration = {
    id: string;
    secret: string;
    uri: {
        [key: string]: string;
    };
};
