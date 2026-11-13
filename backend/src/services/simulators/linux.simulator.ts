export interface VirtualNode {
  name: string;
  isDirectory: boolean;
  content: string;
  children: Map<string, VirtualNode>;
}

export interface LinuxSessionState {
  currentPath: string; // e.g. "/home/student"
  root: VirtualNode;
}

export class LinuxSimulator {
  /**
   * Initializes a fresh Linux virtual file system for the student
   */
  static createInitialState(): LinuxSessionState {
    const root: VirtualNode = {
      name: '/',
      isDirectory: true,
      content: '',
      children: new Map(),
    };

    // Build standard simulated hierarchy: /home/student
    const home: VirtualNode = {
      name: 'home',
      isDirectory: true,
      content: '',
      children: new Map(),
    };
    root.children.set('home', home);

    const student: VirtualNode = {
      name: 'student',
      isDirectory: true,
      content: '',
      children: new Map(),
    };
    home.children.set('student', student);

    // Initial files in /home/student
    student.children.set('welcome.txt', {
      name: 'welcome.txt',
      isDirectory: false,
      content: 'Welcome to Cloud Virtual Lab!\nExplore Linux commands in this isolated educational terminal.\nType "help" for a list of available commands.',
      children: new Map(),
    });

    student.children.set('notes.txt', {
      name: 'notes.txt',
      isDirectory: false,
      content: 'Linux Command Basics:\n- Use "ls" to list files.\n- Use "pwd" to view current directory.\n- Use "mkdir" to create a new directory.',
      children: new Map(),
    });

    return {
      currentPath: '/home/student',
      root,
    };
  }

  /**
   * Resolves a path to a VirtualNode
   */
  private static resolveNode(state: LinuxSessionState, targetPath: string): VirtualNode | null {
    const cleanPath = targetPath.startsWith('/')
      ? targetPath
      : `${state.currentPath}/${targetPath}`;

    const parts = cleanPath.split('/').filter(Boolean);
    let curr = state.root;

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        // Can't go above root
        continue;
      }
      if (!curr.isDirectory || !curr.children.has(part)) {
        return null;
      }
      curr = curr.children.get(part)!;
    }
    return curr;
  }

  /**
   * Executes an allowlisted Linux command in the simulated VFS
   */
  static execute(commandStr: string, state: LinuxSessionState): { output: string; currentPath: string } {
    const trimmed = commandStr.trim();
    if (!trimmed) {
      return { output: '', currentPath: state.currentPath };
    }

    // Parse tokens respecting basic quotes
    const args: string[] = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const command = args[0];

    switch (command) {
      case 'pwd': {
        return { output: state.currentPath, currentPath: state.currentPath };
      }

      case 'whoami': {
        return { output: 'student', currentPath: state.currentPath };
      }

      case 'uname': {
        return {
          output: 'Linux virtuallab-node-01 6.8.0-cloud-generic #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux',
          currentPath: state.currentPath,
        };
      }

      case 'clear': {
        return { output: '\x1b[2J\x1b[H', currentPath: state.currentPath };
      }

      case 'help': {
        const helpText = [
          'Virtual Lab Linux Allowlisted Commands:',
          '  pwd              Print current working directory',
          '  ls [-l] [-a]     List directory contents',
          '  cd <dir>         Change directory',
          '  mkdir <dir>      Create a directory',
          '  touch <file>     Create an empty file',
          '  cat <file>       Concatenate and display file content',
          '  echo <text>      Display a line of text (or echo "text" > file)',
          '  whoami           Print current user name',
          '  uname [-a]       Print system information',
          '  clear            Clear terminal screen',
          '  help             Show this reference guide',
        ].join('\n');
        return { output: helpText, currentPath: state.currentPath };
      }

      case 'ls': {
        const currNode = this.resolveNode(state, state.currentPath);
        if (!currNode || !currNode.isDirectory) {
          return { output: 'ls: cannot access directory', currentPath: state.currentPath };
        }

        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');

        const entries: string[] = [];
        if (showAll) {
          entries.push(showLong ? 'drwxr-xr-x 2 student student 4096 Nov 5 12:00 .' : '.');
          entries.push(showLong ? 'drwxr-xr-x 3 student student 4096 Nov 5 12:00 ..' : '..');
        }

        currNode.children.forEach((node, name) => {
          if (showLong) {
            const perm = node.isDirectory ? 'drwxr-xr-x' : '-rw-r--r--';
            const size = node.isDirectory ? 4096 : node.content.length;
            entries.push(`${perm} 1 student student ${size.toString().padStart(5, ' ')} Nov 5 12:00 ${name}`);
          } else {
            entries.push(name);
          }
        });

        return {
          output: entries.join(showLong ? '\n' : '  '),
          currentPath: state.currentPath,
        };
      }

      case 'cd': {
        const target = args[1] || '/home/student';
        let newPath: string;

        if (target === '~' || target === '/home/student') {
          newPath = '/home/student';
        } else if (target === '/') {
          newPath = '/';
        } else if (target === '..') {
          const parts = state.currentPath.split('/').filter(Boolean);
          parts.pop();
          newPath = '/' + parts.join('/');
          if (!newPath) newPath = '/';
        } else if (target.startsWith('/')) {
          newPath = target;
        } else {
          newPath = state.currentPath === '/' ? `/${target}` : `${state.currentPath}/${target}`;
        }

        const node = this.resolveNode(state, newPath);
        if (!node) {
          return { output: `bash: cd: ${target}: No such file or directory`, currentPath: state.currentPath };
        }
        if (!node.isDirectory) {
          return { output: `bash: cd: ${target}: Not a directory`, currentPath: state.currentPath };
        }

        state.currentPath = newPath;
        return { output: '', currentPath: state.currentPath };
      }

      case 'mkdir': {
        if (!args[1]) {
          return { output: 'mkdir: missing operand', currentPath: state.currentPath };
        }
        const dirName = args[1].replace(/['"]/g, '');
        const currNode = this.resolveNode(state, state.currentPath);

        if (!currNode || !currNode.isDirectory) {
          return { output: 'mkdir: cannot access current directory', currentPath: state.currentPath };
        }
        if (currNode.children.has(dirName)) {
          return { output: `mkdir: cannot create directory '${dirName}': File exists`, currentPath: state.currentPath };
        }

        currNode.children.set(dirName, {
          name: dirName,
          isDirectory: true,
          content: '',
          children: new Map(),
        });

        return { output: `Directory ${dirName} created.`, currentPath: state.currentPath };
      }

      case 'touch': {
        if (!args[1]) {
          return { output: 'touch: missing file operand', currentPath: state.currentPath };
        }
        const fileName = args[1].replace(/['"]/g, '');
        const currNode = this.resolveNode(state, state.currentPath);

        if (!currNode || !currNode.isDirectory) {
          return { output: 'touch: cannot access current directory', currentPath: state.currentPath };
        }

        if (!currNode.children.has(fileName)) {
          currNode.children.set(fileName, {
            name: fileName,
            isDirectory: false,
            content: '',
            children: new Map(),
          });
        }
        return { output: '', currentPath: state.currentPath };
      }

      case 'cat': {
        if (!args[1]) {
          return { output: 'cat: missing file operand', currentPath: state.currentPath };
        }
        const fileName = args[1].replace(/['"]/g, '');
        const currNode = this.resolveNode(state, state.currentPath);

        if (!currNode || !currNode.children.has(fileName)) {
          return { output: `cat: ${fileName}: No such file or directory`, currentPath: state.currentPath };
        }

        const fileNode = currNode.children.get(fileName)!;
        if (fileNode.isDirectory) {
          return { output: `cat: ${fileName}: Is a directory`, currentPath: state.currentPath };
        }

        return { output: fileNode.content, currentPath: state.currentPath };
      }

      case 'echo': {
        // Check for redirection: echo "content" > file
        const redirectIndex = args.indexOf('>');
        if (redirectIndex !== -1 && args[redirectIndex + 1]) {
          const contentParts = args.slice(1, redirectIndex);
          const rawContent = contentParts.join(' ').replace(/^['"]|['"]$/g, '');
          const targetFileName = args[redirectIndex + 1].replace(/['"]/g, '');

          const currNode = this.resolveNode(state, state.currentPath);
          if (currNode && currNode.isDirectory) {
            currNode.children.set(targetFileName, {
              name: targetFileName,
              isDirectory: false,
              content: rawContent,
              children: new Map(),
            });
          }
          return { output: '', currentPath: state.currentPath };
        }

        const echoContent = args.slice(1).join(' ').replace(/^['"]|['"]$/g, '');
        return { output: echoContent, currentPath: state.currentPath };
      }

      default: {
        return {
          output: `bash: ${command}: command not found. Type 'help' to see safe allowlisted commands.`,
          currentPath: state.currentPath,
        };
      }
    }
  }
}
