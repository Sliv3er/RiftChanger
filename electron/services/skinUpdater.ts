import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SKINS_REPO = 'https://github.com/darkseal-org/lol-skins.git';

export class SkinUpdater {
  /**
   * Check if the skins folder is a git repo and can be updated.
   */
  isGitRepo(skinsPath: string): boolean {
    // Go up to the repo root (skins folder might be a subfolder)
    const repoRoot = this.findGitRoot(skinsPath);
    return repoRoot !== null;
  }

  private findGitRoot(dir: string): string | null {
    let current = dir;
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(current, '.git'))) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  }

  /**
   * Update skins library via git pull.
   * The darkseal-org/lol-skins repo is updated per patch with regenerated skins.
   */
  async update(skinsPath: string): Promise<{ success: boolean; message: string; updated: number }> {
    const repoRoot = this.findGitRoot(skinsPath);

    if (!repoRoot) {
      return {
        success: false,
        message: 'Skins folder is not a git repository. Clone it first: git clone https://github.com/darkseal-org/lol-skins.git',
        updated: 0,
      };
    }

    try {
      // Get current commit
      const beforeCommit = execSync('git rev-parse HEAD', {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
      }).trim();

      // Pull latest
      const pullResult = execSync('git pull origin main --ff-only', {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      });

      // Get new commit
      const afterCommit = execSync('git rev-parse HEAD', {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
      }).trim();

      if (beforeCommit === afterCommit) {
        return { success: true, message: 'Already up to date.', updated: 0 };
      }

      // Count changed files
      const diffResult = execSync(`git diff --name-only ${beforeCommit} ${afterCommit}`, {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
      });
      const changedFiles = diffResult.trim().split('\n').filter(f => f.endsWith('.zip')).length;

      return {
        success: true,
        message: `Updated to ${afterCommit.slice(0, 8)}. ${changedFiles} skin files changed.`,
        updated: changedFiles,
      };
    } catch (e: any) {
      // Try git reset if ff-only fails
      try {
        execSync('git fetch origin main', { cwd: repoRoot, windowsHide: true, timeout: 60000 });
        execSync('git reset --hard origin/main', { cwd: repoRoot, windowsHide: true });
        return { success: true, message: 'Force-updated to latest (hard reset).', updated: -1 };
      } catch (e2: any) {
        return { success: false, message: `Update failed: ${e.message}`, updated: 0 };
      }
    }
  }

  /**
   * Clone the skins repo fresh to a target directory.
   */
  async clone(targetDir: string): Promise<{ success: boolean; message: string }> {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      execSync(`git clone --depth 1 ${SKINS_REPO} "${targetDir}"`, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300000,
      });
      return { success: true, message: `Cloned skins repo to ${targetDir}` };
    } catch (e: any) {
      return { success: false, message: `Clone failed: ${e.message}` };
    }
  }

  /**
   * Check the last commit date to see if the library is current-patch.
   */
  getLastUpdateDate(skinsPath: string): string | null {
    const repoRoot = this.findGitRoot(skinsPath);
    if (!repoRoot) return null;

    try {
      const date = execSync('git log -1 --format=%ci', {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
      }).trim();
      return date;
    } catch {
      return null;
    }
  }
}
