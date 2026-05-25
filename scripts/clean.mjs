import { rmSync } from 'node:fs';

for (const path of ['dist', 'dist-electron']) {
  rmSync(path, { recursive: true, force: true });
}
