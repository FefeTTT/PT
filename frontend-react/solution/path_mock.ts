export const path = {
    resolve: (...args: string[]) => args.join('/'),
    join: (...args: string[]) => args.join('/')
};
export default path;
