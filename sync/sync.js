const fs = require('fs');
const path = require('path');

const LOCAL_STORAGE_DIR = 'C:\\Users\\3.14vo\\Desktop\\files';


// stat -f "%m%t%Sm %N" /tmp/* | sort -rn | head -3 | cut -f2-


// find $1 -type f -exec stat --format '%Y :%y %n' "{}" \; | sort -nr | cut -d: -f2- | head


// https://nicolasbouliane.com/blog/knowing-difference-mtime-ctime-atime


const State = {
    async load() {
        return {
            files: [
                {file: '\\3.jpg', type: 'f', ts: 1654094191785.59},
                {file: '\\1.jpg', type: 'f', ts: 1653256509602.706},
                {file: '\\2.jpg', type: 'f', ts: 1653256609355.4},
                { file: '\\test.txt', type: 'f', ts: 1654294181718.798 }
            ],
            lastUpdate: 1654233783740, // 2022-06-03T05:23:03.740Z
        };
        // TODO: load sync from local file 'sync.json'
    },

    async save() {
        return true;
        // TODO: save to fs

    },

    async print(state) {
        state.files.forEach(f => {
            const ts = new Date(f.ts * 1000);
            console.log(`${f.ts}\t${ts.toString()}\t${f.type}\t${f.file}`);
        });
    }
};

const LocalStorage = {
    dir: LOCAL_STORAGE_DIR,

    async getFilesState() {
        // scan local storage, build local sync
        // https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search

        var walk = function (dir, done) {
            var results = [];
            fs.readdir(dir, function (err, list) {
                if (err) return done(err);
                var pending = list.length;
                if (!pending) return done(null, results);
                list.forEach(function (file) {
                    file = path.resolve(dir, file);
                    fs.stat(file, function (err, stat) {
                        // console.log(file);
                        // console.log(stat);
                        if (stat && stat.isDirectory()) {
                            results.push({file, type: 'd', ts: stat.mtimeMs});
                            walk(file, function (err, res) {
                                results = results.concat(res);
                                if (!--pending) done(null, results);
                            });
                        } else {
                            results.push({file, type: 'f', ts: stat.mtimeMs});
                            if (!--pending) done(null, results);
                        }
                    });
                });
            });
        };

        return new Promise((resolve, reject) => {
            walk(LocalStorage.dir, function (err, results) {
                if (err) return reject(err);
                const files = results.map(file => {
                    return {
                        ...file,
                        file: file.file.replace(LocalStorage.dir, ''),
                    };
                });
                const state = {
                    files,
                    lastUpdate: new Date(),
                };
                return resolve(state);
            });
        });
    }
}


// remote storage
const loadStateFromAPI = async () => {
    return {
        files: [
            {file: '\\3.jpg', type: 'f', ts: 1654094191785.59},
            {file: '\\1.jpg', type: 'f', ts: 1653256509602.706},
            {file: '\\2.jpg', type: 'f', ts: 1653256609355.4},
            { file: '\\test.txt', type: 'f', ts: 1654294181718.798 }
        ],
    };
    // const sync = await fetch('https://cloud-storage.dev/api/files');
    // return sync;
}

function ReconcileAction(action, argument1, argument2) {
    this.action = action;
    this.argument1 = argument1;
    this.argument2 = argument2;
}

const reconcile = async (localStoredState, localState, remoteState) => {
    // 1. find files changed locally
    const actions = [];
    for (const localFile of localState.files) {
        const {file, ts, type} = localFile;
        // 1. find this file in stored sync
        // 2. if file not found:
        //    - need to upload it to remote storage
        // 3. if file found - check it's mtime
        //    3.1 if local mtime > sync mtime:
        //    - need to upload it to remote
        //    3.2 if local mtime < sync mtime:
        //    - .... unknown. probably download from remote
        const found = localStoredState.files.find(s => s.file === localFile.file);
        if (!found) {
            actions.push(new ReconcileAction('uploadMissed', localFile));
        } else {
            if (localFile.type === 'f') { // do not check directories
                if (localFile.ts > found.ts) {
                    actions.push(new ReconcileAction('uploadUpdated', localFile, found));
                } else if (localFile.ts < found.ts) {
                    actions.push(new ReconcileAction('downloadUpdated', localFile, found)); // unknown... TODO decide later
                }
            }
        }
    }
    for (const stateFile of localStoredState.files) {
        const found = localState.files.find(s => s.file === stateFile.file);
        if (!found) {
            // local file was deleted. need to delete it from remote storage
            actions.push(new ReconcileAction('deleteRemote', stateFile));
        }
    }
    // 2. find files changed remotely
    // TODO
    return actions;
};

console.log(LocalStorage)

async function main() {
    const localStoredState = await State.load();
    console.log('\n* Local Stored sync\n');
    await State.print(localStoredState);
    const remoteState = await loadStateFromAPI();
    console.log('\n* Remote sync\n');
    await State.print(remoteState);

    const localState = await LocalStorage.getFilesState();
    console.log('\n* Local sync\n');
    await State.print(localState);

    const actions = await reconcile(localStoredState, localState, remoteState);
    console.log('\n* Reconcile Actions\n');
    console.log(actions);
}
void main();

// fs.readFile('sync.json', (err, data) => {
//     if (err) throw err;
//     var json = JSON.parse(data);
//     console.log('\n* Info ');
//     console.log(json);
// });
