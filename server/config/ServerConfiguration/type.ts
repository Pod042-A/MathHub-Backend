export type Configuration = {
    port: number;
    accessToken: {
        /**
         * @description 來源名稱，使用後端域名
         */
        iss: string;
        /**
         * @description 接收對象名稱，使用後端域名
         */
        aud: string;
    };
    idToken: {
        /**
         * @description 來源名稱，使用後端域名
         */
        iss: string;
        /**
         * @description 接收對象名稱，使用前端域名
         */
        aud: string;
    };
};
