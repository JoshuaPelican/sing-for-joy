
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const configPath = path.join(
  process.cwd(),
  'js/config.js'
);

const text = fs.readFileSync(configPath, 'utf8');

// Read the repository's checked-in config.
const previous = vm.runInNewContext(
  `${text}
   ({
     songFiles,
     creditList: typeof creditList === 'undefined'
       ? undefined
       : creditList
   })`,
  {},
  { timeout: 1000 }
);

const lists = JSON.parse(
  JSON.stringify(previous.songFiles)
);

const originalCredits = previous.creditList
  ? JSON.parse(JSON.stringify(previous.creditList))
  : [];

// Preserve previous global credits during migration.
if (
  originalCredits.length &&
  lists.length &&
  !lists[0].credits
) {
  lists[0].credits = originalCredits;
}

for (const list of lists) {
  if (!Array.isArray(list.credits)) {
    list.credits = [];
  }
}

const payload = JSON.parse(
  process.env.LIST_JSON || '{}'
);

const validDate = value => {
  if (
    typeof value !== 'string' ||
    !/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)
  ) {
    return false;
  }

  const [m, d, y] = value.split('-').map(Number);
  const actual = new Date(Date.UTC(y, m - 1, d));

  return (
    actual.getUTCFullYear() === y &&
    actual.getUTCMonth() + 1 === m &&
    actual.getUTCDate() === d
  );
};

const dateSort = value => {
  const [m, d, y] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

if (
  !['add', 'edit'].includes(payload.mode) ||
  !validDate(payload.date)
) {
  throw Error('Invalid action or date');
}

if (
  !Array.isArray(payload.songs) ||
  !payload.songs.length ||
  payload.songs.length > 100 ||
  !payload.songs.every(id =>
    typeof id === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
  )
) {
  throw Error('Invalid songs');
}

if (
  !Array.isArray(payload.credits) ||
  payload.credits.length > 50 ||
  !payload.credits.every(c =>
    c &&
    typeof c.name === 'string' &&
    typeof c.role === 'string' &&
    c.name.trim().length > 0 &&
    c.role.trim().length > 0 &&
    c.name.length <= 150 &&
    c.role.length <= 150
  )
) {
  throw Error('Invalid credits');
}

const entry = {
  date: payload.date,
  songs: [...payload.songs],
  credits: payload.credits.map(c => ({
    name: c.name.trim(),
    role: c.role.trim()
  }))
};

if (payload.mode === 'add') {
  if (lists.some(l => l.date === entry.date)) {
    throw Error('A list already exists on that date');
  }

  lists.push(entry);
} else {
  if (!validDate(payload.original_date)) {
    throw Error('Missing original date');
  }

  const i = lists.findIndex(
    l => l.date === payload.original_date
  );

  if (i < 0) {
    throw Error('Original song list not found');
  }

  if (
    lists.some((l, j) =>
      j !== i && l.date === entry.date
    )
  ) {
    throw Error('Another list already uses that date');
  }

  lists[i] = entry;
}

// Latest list always appears first.
lists.sort(
  (a, b) => dateSort(b.date) - dateSort(a.date)
);

fs.writeFileSync(
  configPath,
  `const songFiles = ${JSON.stringify(lists, null, 2)};\n`,
  'utf8'
);

console.log(
  `${payload.mode === 'add' ? 'Added' : 'Updated'} song list ${entry.date}`
);
