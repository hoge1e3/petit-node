// generated from real node:fs
const props=["appendFile","appendFileSync","access","accessSync","chown","chownSync","chmod","chmodSync","close","closeSync","constants","copyFile","copyFileSync","cp","cpSync","createReadStream","createWriteStream","exists","existsSync","fchown","fchownSync","fchmod","fchmodSync","fdatasync","fdatasyncSync","fstat","fstatSync","fsync","fsyncSync","ftruncate","ftruncateSync","futimes","futimesSync","lchown","lchownSync","lchmod","lchmodSync","link","linkSync","lstat","lstatSync","lutimes","lutimesSync","mkdir","mkdirSync","mkdtemp","mkdtempSync","open","openSync","openAsBlob","readdir","readdirSync","read","readSync","readv","readvSync","readFile","readFileSync","readlink","readlinkSync","realpath","realpathSync","rename","renameSync","rm","rmSync","rmdir","rmdirSync","stat","statfs","statSync","statfsSync","symlink","symlinkSync","truncate","truncateSync","unwatchFile","unlink","unlinkSync","utimes","utimesSync","watch","watchFile","writeFile","writeFileSync","write","writeSync","writev","writevSync","Dirent","Stats","ReadStream","WriteStream","FileReadStream","FileWriteStream","_toUnixTimestamp","Dir","opendir","opendirSync","F_OK","R_OK","W_OK","X_OK","constants","promises"];
export function gen(fs:any) {
    const res={} as any;
    for (let p of props) {
        const v=fs[p];
        if (typeof v==="function"){
            res[p]=v.bind(fs);
        } else if (v!==undefined) {
            res[p]=v;
        }
    }
    return res;
}