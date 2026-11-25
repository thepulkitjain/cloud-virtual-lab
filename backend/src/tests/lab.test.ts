import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { Role } from '@prisma/client';
import { LinuxSimulator } from '../services/simulators/linux.simulator';
import { NetworkingSimulator } from '../services/simulators/networking.simulator';
import { ProgrammingSimulator } from '../services/simulators/programming.simulator';
import { DatabaseSimulator } from '../services/simulators/database.simulator';
import { LabSimulatorService } from '../services/lab-simulator.service';
import { redisService } from '../services/redis/redis.service';
import RedisMock from 'ioredis-mock';

const app = createApp();

describe('Module 2: Virtual Laboratory Management Tests', () => {
  let studentCookie: string;
  let otherStudentCookie: string;
  let adminCookie: string;
  let studentId: string;
  let otherStudentId: string;
  let linuxLabId: string;
  let activeSessionId: string;
  let activeExerciseId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    // 1. Register Student A
    const studentEmail = `lab_student_${Date.now()}@virtuallab.edu`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Lab',
        lastName: 'Student',
        email: studentEmail,
        password: 'Password123!@#',
      });
    studentId = regRes.body.data.user.id;
    studentCookie = regRes.headers['set-cookie'][0];

    // 2. Register Student B (for multi-tenant isolation testing)
    const otherEmail = `lab_other_${Date.now()}@virtuallab.edu`;
    const otherRegRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Other',
        lastName: 'Student',
        email: otherEmail,
        password: 'Password123!@#',
      });
    otherStudentId = otherRegRes.body.data.user.id;
    otherStudentCookie = otherRegRes.headers['set-cookie'][0];

    // 3. Login Admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    adminCookie = adminLoginRes.headers['set-cookie'][0];

    // 4. Retrieve Linux Lab ID
    const lab = await prisma.lab.findUnique({
      where: { slug: 'linux-command-basics' },
      include: { exercises: { orderBy: { orderIndex: 'asc' } } },
    });
    if (lab) {
      linuxLabId = lab.id;
      activeExerciseId = lab.exercises[0].id;
    }
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [studentId, otherStudentId] } },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore cleanup
    }
  });

  describe('1. Isolated Simulators Unit Testing', () => {
    it('Linux Simulator: handles pwd, mkdir, cd, touch, echo, cat and whoami', () => {
      const state = LinuxSimulator.createInitialState();

      expect(LinuxSimulator.execute('pwd', state).output).toBe('/home/student');
      expect(LinuxSimulator.execute('whoami', state).output).toBe('student');

      // Create folder and navigate
      LinuxSimulator.execute('mkdir my_project', state);
      const cdRes = LinuxSimulator.execute('cd my_project', state);
      expect(cdRes.currentPath).toBe('/home/student/my_project');
      expect(LinuxSimulator.execute('pwd', state).output).toBe('/home/student/my_project');

      // Write content and read back
      LinuxSimulator.execute('echo "Hello Virtual Lab" > sample.txt', state);
      const catRes = LinuxSimulator.execute('cat sample.txt', state);
      expect(catRes.output).toBe('Hello Virtual Lab');

      // Unrecognized command
      const badRes = LinuxSimulator.execute('powershell -Command Get-Process', state);
      expect(badRes.output).toContain('command not found');
    });

    it('Linux Simulator: tab autocompletes allowlisted commands and VFS file/directory paths', () => {
      const state = LinuxSimulator.createInitialState();

      // 1. Empty command line -> returns all allowlisted commands
      const emptyComp = LinuxSimulator.getCompletions('', state);
      expect(emptyComp.isCommand).toBe(true);
      expect(emptyComp.hasMultiple).toBe(true);
      expect(emptyComp.matches).toContain('pwd');
      expect(emptyComp.matches).toContain('cat');

      // 2. Command completion - single match
      const pComp = LinuxSimulator.getCompletions('p', state);
      expect(pComp.isCommand).toBe(true);
      expect(pComp.completedLine).toBe('pwd ');
      expect(pComp.matches).toEqual(['pwd']);
      expect(pComp.hasMultiple).toBe(false);

      const whoComp = LinuxSimulator.getCompletions('who', state);
      expect(whoComp.completedLine).toBe('whoami ');
      expect(whoComp.matches).toEqual(['whoami']);

      // 3. Command completion - multiple matches with LCP
      const cComp = LinuxSimulator.getCompletions('c', state);
      expect(cComp.isCommand).toBe(true);
      expect(cComp.hasMultiple).toBe(true);
      expect(cComp.matches).toEqual(['cat', 'cd', 'clear']);
      expect(cComp.completedLine).toBe('c');

      // 4. File completion - single match in current dir (/home/student)
      const catW = LinuxSimulator.getCompletions('cat w', state);
      expect(catW.isCommand).toBe(false);
      expect(catW.completedLine).toBe('cat welcome.txt ');
      expect(catW.matches).toEqual(['welcome.txt']);

      // 5. File completion - multiple matches in current dir
      const catEmpty = LinuxSimulator.getCompletions('cat ', state);
      expect(catEmpty.isCommand).toBe(false);
      expect(catEmpty.hasMultiple).toBe(true);
      expect(catEmpty.matches).toEqual(['notes.txt', 'welcome.txt']);

      // 6. Directory completion - cd prioritizes directories and appends trailing slash
      LinuxSimulator.execute('mkdir my_folder', state);
      const cdComp = LinuxSimulator.getCompletions('cd my', state);
      expect(cdComp.completedLine).toBe('cd my_folder/');
      expect(cdComp.matches).toEqual(['my_folder/']);

      // 7. Path navigation completion (absolute path)
      const absComp = LinuxSimulator.getCompletions('cd /h', state);
      expect(absComp.completedLine).toBe('cd /home/');

      // 8. Relative parent directory path completion
      const parentComp = LinuxSimulator.getCompletions('cat ../', state);
      expect(parentComp.matches).toContain('student/');

      // 9. Non-existent path completion -> graceful empty matches
      const noMatch = LinuxSimulator.getCompletions('cat nonexistent', state);
      expect(noMatch.matches).toEqual([]);
      expect(noMatch.completedLine).toBe('cat nonexistent');
    });

    it('Networking Simulator: handles ping, ifconfig, nslookup, traceroute and curl', () => {
      const pingOut = NetworkingSimulator.execute('ping -c 4 192.168.1.1');
      expect(pingOut).toContain('4 packets transmitted');
      expect(pingOut).toContain('0% packet loss');

      const ifconfigOut = NetworkingSimulator.execute('ifconfig');
      expect(ifconfigOut).toContain('eth0: flags=4163');
      expect(ifconfigOut).toContain('192.168.1.105');

      const nslookupOut = NetworkingSimulator.execute('nslookup virtuallab.edu');
      expect(nslookupOut).toContain('Address: 10.0.15.42');

      const traceOut = NetworkingSimulator.execute('traceroute gateway.virtuallab.edu');
      expect(traceOut).toContain('traceroute to');

      const curlOut = NetworkingSimulator.execute('curl -I http://virtuallab.edu');
      expect(curlOut).toContain('HTTP/1.1 200 OK');
    });

    it('Programming Simulator: evaluates python and node without host code execution', () => {
      const pyOut = ProgrammingSimulator.execute('python3 app.py');
      expect(pyOut).toContain('Virtual Lab Python Runtime Ready: 200 OK');

      const nodeOut = ProgrammingSimulator.execute('node index.js');
      expect(nodeOut).toContain('"status": "success"');

      // Arbitrary host escapes are strictly treated as unrecognized or safe mock
      const badOut = ProgrammingSimulator.execute('cmd.exe /c dir');
      expect(badOut).toContain('not supported');
    });

    it('Database Simulator: executes in-memory SQL without querying actual database', () => {
      const dbState = DatabaseSimulator.createInitialState();

      const dtOut = DatabaseSimulator.execute('\\dt', dbState);
      expect(dtOut).toContain('students');
      expect(dtOut).toContain('courses');

      const selectOut = DatabaseSimulator.execute('SELECT * FROM students WHERE gpa > 3.5;', dbState);
      expect(selectOut).toContain('Alice Smith');
      expect(selectOut).toContain('Catherine Lee');
      expect(selectOut).not.toContain('Bob Jones'); // Bob GPA is 3.2

      const insertOut = DatabaseSimulator.execute('INSERT INTO students (name) VALUES (\'David\');', dbState);
      expect(insertOut).toBe('INSERT 0 1');
    });
  });

  describe('2. Lab Browsing & Details API', () => {
    it('GET /api/v1/labs: should return list of available laboratories', async () => {
      const res = await request(app).get('/api/v1/labs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.labs.length).toBeGreaterThanOrEqual(4);
      const titles = res.body.data.labs.map((l: any) => l.title);
      expect(titles).toContain('Linux Command-Line Essentials');
      expect(titles).toContain('Networking & Connectivity Fundamentals');
    });

    it('GET /api/v1/labs/:slug: should return lab details and ordered exercises', async () => {
      const res = await request(app)
        .get('/api/v1/labs/linux-command-basics')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lab.exercises.length).toBe(3);
      expect(res.body.data.lab.exercises[0].orderIndex).toBe(1);
    });
  });

  describe('3. Student Lab Session Life-cycle & Execution', () => {
    it('POST /api/v1/labs/:labId/sessions: should start an IN_PROGRESS session', async () => {
      const res = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session.status).toBe('IN_PROGRESS');
      activeSessionId = res.body.data.session.id;
    });

    it('POST /api/v1/labs/sessions/:sessionId/execute: executes allowlisted command and evaluates exercise', async () => {
      const res = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/execute`)
        .set('Cookie', studentCookie)
        .send({
          command: 'pwd',
          exerciseId: activeExerciseId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.output).toBe('/home/student');
      expect(res.body.data.exercisePassed).toBe(true);
      expect(res.body.data.submission).toBeDefined();
      expect(res.body.data.submission.status).toBe('PASSED');
      expect(res.body.data.currentScore).toBeGreaterThan(0);
    });

    it('POST /api/v1/labs/sessions/:sessionId/complete: evaluates tab-completion in active session', async () => {
      // 1. Tab complete command
      const cmdRes = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/complete`)
        .set('Cookie', studentCookie)
        .send({ line: 'wh' });

      expect(cmdRes.status).toBe(200);
      expect(cmdRes.body.success).toBe(true);
      expect(cmdRes.body.data.completedLine).toBe('whoami ');
      expect(cmdRes.body.data.matches).toEqual(['whoami']);
      expect(cmdRes.body.data.isCommand).toBe(true);

      // 2. Tab complete file in current directory
      const fileRes = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/complete`)
        .set('Cookie', studentCookie)
        .send({ line: 'cat w' });

      expect(fileRes.status).toBe(200);
      expect(fileRes.body.data.completedLine).toBe('cat welcome.txt ');
      expect(fileRes.body.data.matches).toEqual(['welcome.txt']);
      expect(fileRes.body.data.isCommand).toBe(false);
    });

    it('GET /api/v1/labs/my-sessions: lists user active/historical sessions', async () => {
      const res = await request(app)
        .get('/api/v1/labs/my-sessions')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessions.some((s: any) => s.id === activeSessionId)).toBe(true);
    });

    it('POST /api/v1/labs/sessions/:sessionId/end: ends session and sets COMPLETED status', async () => {
      const res = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/end`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session.status).toBe('COMPLETED');
      expect(res.body.data.session.endedAt).toBeDefined();
    });
  });

  describe('4. Security & Multi-Tenant Authorization', () => {
    it('SECURITY CHECK: Student B cannot execute commands on Student A session (403 Forbidden)', async () => {
      // Start another session for Student A
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const newSessionId = startRes.body.data.session.id;

      // Student B attempts to execute command on Student A's session
      const hackerRes = await request(app)
        .post(`/api/v1/labs/sessions/${newSessionId}/execute`)
        .set('Cookie', otherStudentCookie)
        .send({ command: 'whoami' });

      expect(hackerRes.status).toBe(403);
      expect(hackerRes.body.success).toBe(false);
      expect(hackerRes.body.message).toContain('Forbidden');
    });

    it('SECURITY CHECK: Student B cannot tab-complete on Student A session (403 Forbidden)', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const targetSessionId = startRes.body.data.session.id;

      const res = await request(app)
        .post(`/api/v1/labs/sessions/${targetSessionId}/complete`)
        .set('Cookie', otherStudentCookie)
        .send({ line: 'ls' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('SECURITY CHECK: Cannot tab-complete on an already COMPLETED session (400 Bad Request)', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const closedSessionId = startRes.body.data.session.id;

      await request(app)
        .post(`/api/v1/labs/sessions/${closedSessionId}/end`)
        .set('Cookie', studentCookie);

      const res = await request(app)
        .post(`/api/v1/labs/sessions/${closedSessionId}/complete`)
        .set('Cookie', studentCookie)
        .send({ line: 'ls' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('closed');
    });

    it('SECURITY CHECK: Unauthenticated tab-completion is rejected (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/labs/sessions/00000000-0000-0000-0000-000000000000/complete')
        .send({ line: 'ls' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('SECURITY CHECK: Student cannot access Admin lab creation endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/labs')
        .set('Cookie', studentCookie)
        .send({
          title: 'Unauthorized Lab',
          slug: 'unauthorized-lab',
          description: 'Hacking attempt to create a lab',
          category: 'LINUX',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Admin can create a new laboratory and add exercises', async () => {
      const slug = `custom-lab-${Date.now()}`;
      const labRes = await request(app)
        .post('/api/v1/admin/labs')
        .set('Cookie', adminCookie)
        .send({
          title: 'Advanced Cloud Docker Lab',
          slug,
          description: 'Educational container isolation techniques and cgroup limits.',
          category: 'LINUX',
          difficulty: 'ADVANCED',
          estimatedMinutes: 45,
        });

      expect(labRes.status).toBe(201);
      expect(labRes.body.success).toBe(true);
      const createdLabId = labRes.body.data.lab.id;

      // Add exercise to created lab
      const exRes = await request(app)
        .post(`/api/v1/admin/labs/${createdLabId}/exercises`)
        .set('Cookie', adminCookie)
        .send({
          orderIndex: 1,
          title: 'Container Namespace Inspection',
          instruction: 'Inspect PID namespace using whoami.',
          expectedCommand: 'whoami',
          expectedOutput: 'student',
        });

      expect(exRes.status).toBe(201);
      expect(exRes.body.success).toBe(true);
      expect(exRes.body.data.exercise.title).toBe('Container Namespace Inspection');

      // Clean up test lab (cascades to exercises)
      await prisma.lab.delete({ where: { id: createdLabId } });
    });
  });

  describe('5. Comprehensive Linux Terminal Operations', () => {
    it('verifies pwd, ls, ls -l, ls -a, mkdir, cd, touch, echo, cat, clear', () => {
      const state = LinuxSimulator.createInitialState();

      // pwd
      expect(LinuxSimulator.execute('pwd', state).output).toBe('/home/student');

      // ls standard
      const lsBasic = LinuxSimulator.execute('ls', state);
      expect(lsBasic.output).toContain('welcome.txt');
      expect(lsBasic.output).toContain('notes.txt');

      // ls -l
      const lsLong = LinuxSimulator.execute('ls -l', state);
      expect(lsLong.output).toContain('-rw-r--r--');
      expect(lsLong.output).toContain('student');

      // ls -a
      const lsAll = LinuxSimulator.execute('ls -a', state);
      expect(lsAll.output).toContain('.');
      expect(lsAll.output).toContain('..');

      // mkdir error on missing operand
      expect(LinuxSimulator.execute('mkdir', state).output).toContain('missing operand');

      // mkdir success
      const mkdirRes = LinuxSimulator.execute('mkdir lab_files', state);
      expect(mkdirRes.output).toContain('created');

      // mkdir duplicate error
      expect(LinuxSimulator.execute('mkdir lab_files', state).output).toContain('File exists');

      // cd into lab_files
      const cdRes = LinuxSimulator.execute('cd lab_files', state);
      expect(cdRes.currentPath).toBe('/home/student/lab_files');

      // cd ..
      const cdUp = LinuxSimulator.execute('cd ..', state);
      expect(cdUp.currentPath).toBe('/home/student');

      // cd non-existent directory
      const cdBad = LinuxSimulator.execute('cd does_not_exist', state);
      expect(cdBad.output).toContain('No such file or directory');

      // touch error on missing operand
      expect(LinuxSimulator.execute('touch', state).output).toContain('missing file operand');

      // touch create new file
      LinuxSimulator.execute('touch script.sh', state);
      expect(LinuxSimulator.execute('ls', state).output).toContain('script.sh');

      // echo and cat
      LinuxSimulator.execute('echo "echo Hello World" > script.sh', state);
      expect(LinuxSimulator.execute('cat script.sh', state).output).toBe('echo Hello World');

      // cat error cases
      expect(LinuxSimulator.execute('cat', state).output).toContain('missing file operand');
      expect(LinuxSimulator.execute('cat non_existent.txt', state).output).toContain('No such file or directory');
      expect(LinuxSimulator.execute('cat lab_files', state).output).toContain('Is a directory');

      // clear screen ANSI escape code
      expect(LinuxSimulator.execute('clear', state).output).toBe('\x1b[2J\x1b[H');

      // invalid command
      expect(LinuxSimulator.execute('sudo rm -rf /', state).output).toContain('command not found');
    });
  });

  describe('6. Comprehensive Networking Simulator Operations', () => {
    it('verifies ping, ifconfig, ipconfig, nslookup, traceroute, netstat, curl, and curl -I', () => {
      // ping
      const pingLocal = NetworkingSimulator.execute('ping localhost');
      expect(pingLocal).toContain('PING localhost');
      expect(pingLocal).toContain('0% packet loss');

      const pingRemote = NetworkingSimulator.execute('ping 10.0.15.42');
      expect(pingRemote).toContain('56(84) bytes of data');

      // ifconfig & ipconfig
      expect(NetworkingSimulator.execute('ifconfig')).toContain('192.168.1.105');
      expect(NetworkingSimulator.execute('ipconfig')).toContain('192.168.1.105');

      // nslookup
      expect(NetworkingSimulator.execute('nslookup custom.virtuallab.edu')).toContain('custom.virtuallab.edu');
      expect(NetworkingSimulator.execute('nslookup')).toContain('virtuallab.edu');

      // traceroute & tracert
      expect(NetworkingSimulator.execute('traceroute 10.0.15.42')).toContain('30 hops max');
      expect(NetworkingSimulator.execute('tracert 10.0.15.42')).toContain('30 hops max');

      // netstat
      const netstatRes = NetworkingSimulator.execute('netstat');
      expect(netstatRes).toContain(':22');
      expect(netstatRes).toContain(':5432');
      expect(netstatRes).toContain(':80');
      expect(netstatRes).toContain('LISTEN');

      // curl
      const curlBody = NetworkingSimulator.execute('curl http://virtuallab.edu');
      expect(curlBody).toContain('Cloud Virtual Lab Educational Gateway');

      // curl -I (headers only)
      const curlHeaders = NetworkingSimulator.execute('curl -I http://virtuallab.edu');
      expect(curlHeaders).toContain('HTTP/1.1 200 OK');
      expect(curlHeaders).toContain('Content-Type: application/json');

      // help & invalid command
      expect(NetworkingSimulator.execute('help')).toContain('Diagnostic Commands');
      expect(NetworkingSimulator.execute('arbitrary_tool')).toContain('not a recognized networking command');
    });
  });

  describe('7. Comprehensive Programming Lab & Safe Evaluation', () => {
    it('verifies python3 and node execution, code evaluation, and zero host execution', () => {
      // Python runtime ready
      expect(ProgrammingSimulator.execute('python3 app.py')).toContain('Virtual Lab Python Runtime Ready');
      expect(ProgrammingSimulator.execute('python3 main.py')).toContain('Test Case 1');
      expect(ProgrammingSimulator.execute('python3')).toContain('Python 3.11.8');
      expect(ProgrammingSimulator.execute('python3 missing_file.py')).toContain('No such file or directory');

      // Python code snippet evaluation (no host child_process)
      const pySnippet = ProgrammingSimulator.execute('python3 -c "code"', 'print("Calculated Result: 42")');
      expect(pySnippet).toBe('Calculated Result: 42');

      // Node.js runtime ready
      expect(ProgrammingSimulator.execute('node index.js')).toContain('"status": "success"');
      expect(ProgrammingSimulator.execute('node')).toContain('Welcome to Node.js');
      expect(ProgrammingSimulator.execute('node missing.js')).toContain('Cannot find module');

      // Node code snippet evaluation
      const jsSnippet = ProgrammingSimulator.execute('node -e "code"', 'console.log("Processed Buffer");');
      expect(jsSnippet).toBe('Processed Buffer');

      // Security: Host OS attack commands strictly rejected without execution
      const bashEscape = ProgrammingSimulator.execute('/bin/bash -c "whoami"');
      expect(bashEscape).toContain('not supported');

      const powershellEscape = ProgrammingSimulator.execute('powershell.exe -Command "whoami"');
      expect(powershellEscape).toContain('not supported');
    });

    it('evaluates modified Python & JavaScript code buffers, handles unsupported constructs, and blocks host access', () => {
      // Modified Python function + f-string
      const pyCode = [
        'def add_numbers(a, b):',
        '    return a + b',
        'result = add_numbers(10, 32)',
        'print(f"Sum Result: {result}")',
      ].join('\n');
      expect(ProgrammingSimulator.execute('python3 app.py', pyCode, 'python')).toBe('Sum Result: 42');

      // Modified JavaScript function + object + JSON.stringify
      const jsCode = [
        'const modules = ["auth", "lab"];',
        'function buildStatus(list) {',
        '  return { status: "ok", modules: list };',
        '}',
        'console.log(JSON.stringify(buildStatus(modules)));',
      ].join('\n');
      expect(ProgrammingSimulator.execute('node index.js', jsCode, 'javascript')).toBe(
        '{"status":"ok","modules":["auth","lab"]}'
      );

      // Empty code buffer
      expect(ProgrammingSimulator.execute('python3 app.py', '   ', 'python')).toContain('empty');
      expect(ProgrammingSimulator.execute('node index.js', '', 'javascript')).toContain('empty');

      // Runtime mismatch
      expect(ProgrammingSimulator.execute('python3 app.py', 'console.log(1)', 'javascript')).toContain(
        'Runtime mismatch'
      );

      // Security denylist
      expect(ProgrammingSimulator.execute('python3 app.py', 'import os\nprint("hi")', 'python')).toContain(
        'Sandbox Security'
      );
      expect(
        ProgrammingSimulator.execute('node index.js', 'const fs = require("fs");', 'javascript')
      ).toContain('Sandbox Security');

      // Unsupported constructs produce clear simulated messages
      expect(ProgrammingSimulator.execute('python3 app.py', 'while True:\n  print(1)', 'python')).toContain(
        'Unsupported construct'
      );
      expect(ProgrammingSimulator.execute('node index.js', 'class Demo {}', 'javascript')).toContain(
        'Unsupported construct'
      );
    });
  });

  describe('8. Comprehensive SQL Playground & Database Isolation', () => {
    it('verifies SELECT, INSERT, UPDATE, DELETE, metadata commands, and zero application DB access', () => {
      const dbState = DatabaseSimulator.createInitialState();

      // Meta commands
      expect(DatabaseSimulator.execute('\\dt', dbState)).toContain('students');
      expect(DatabaseSimulator.execute('\\dt', dbState)).toContain('courses');
      expect(DatabaseSimulator.execute('\\d students', dbState)).toContain('Table "public.students"');
      expect(DatabaseSimulator.execute('\\l', dbState)).toContain('virtual_lab_edu');
      expect(DatabaseSimulator.execute('\\d non_existent', dbState)).toContain('Did not find any relation');

      // SELECT queries
      const selectAll = DatabaseSimulator.execute('SELECT * FROM students;', dbState);
      expect(selectAll).toContain('Alice Smith');
      expect(selectAll).toContain('Bob Jones');
      expect(selectAll).toContain('Catherine Lee');

      // SELECT WHERE filter
      const selectGpa = DatabaseSimulator.execute('SELECT * FROM students WHERE gpa > 3.5;', dbState);
      expect(selectGpa).toContain('Alice Smith');
      expect(selectGpa).not.toContain('Bob Jones');

      // SELECT courses
      expect(DatabaseSimulator.execute('SELECT * FROM courses;', dbState)).toContain('CS101');

      // INSERT
      const initialCount = dbState.students.length;
      const insertRes = DatabaseSimulator.execute("INSERT INTO students (name) VALUES ('Emily Clark');", dbState);
      expect(insertRes).toBe('INSERT 0 1');
      expect(dbState.students.length).toBe(initialCount + 1);

      // UPDATE
      expect(DatabaseSimulator.execute("UPDATE students SET gpa = 4.0 WHERE name = 'Alice Smith';", dbState)).toBe('UPDATE 1');

      // DELETE
      expect(DatabaseSimulator.execute('DELETE FROM students WHERE id = 1;', dbState)).toBe('DELETE 1');
      expect(dbState.students.length).toBe(initialCount);

      // Syntax error handling
      expect(DatabaseSimulator.execute('INVALID SQL QUERY', dbState)).toContain('ERROR: syntax error');

      // Confirm zero real DB access: simulator operates purely on in-memory object
      expect((dbState as any).User).toBeUndefined();
    });
  });

  describe('9. Session Lifecycle, Submissions, and Security Boundaries', () => {
    it('resumes existing session when starting same lab again', async () => {
      // Start session 1
      const res1 = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const session1Id = res1.body.data.session.id;

      // Start same lab again -> returns same session1Id (resume functionality)
      const res2 = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      expect(res2.body.data.session.id).toBe(session1Id);
    });

    it('POST /api/v1/labs/sessions/:sessionId/submit: records exercise submission', async () => {
      // Get or start active session
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const sessId = startRes.body.data.session.id;

      const subRes = await request(app)
        .post(`/api/v1/labs/sessions/${sessId}/submit`)
        .set('Cookie', studentCookie)
        .send({
          exerciseId: activeExerciseId,
          commandInput: 'pwd',
          outputResult: '/home/student',
        });

      expect(subRes.status).toBe(200);
      expect(subRes.body.success).toBe(true);
      expect(subRes.body.data.exercisePassed).toBe(true);
    });

    it('GET /api/v1/labs/sessions/:sessionId: returns full session details and submissions', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const sessId = startRes.body.data.session.id;

      const res = await request(app)
        .get(`/api/v1/labs/sessions/${sessId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session.id).toBe(sessId);
      expect(res.body.data.session.lab).toBeDefined();
    });

    it('SECURITY CHECK: Student B cannot get session details of Student A (403 Forbidden)', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const sessId = startRes.body.data.session.id;

      const res = await request(app)
        .get(`/api/v1/labs/sessions/${sessId}`)
        .set('Cookie', otherStudentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('SECURITY CHECK: Student B cannot end session of Student A (403 Forbidden)', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const sessId = startRes.body.data.session.id;

      const res = await request(app)
        .post(`/api/v1/labs/sessions/${sessId}/end`)
        .set('Cookie', otherStudentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('SECURITY CHECK: Unauthenticated requests to session endpoints are rejected (401 Unauthorized)', async () => {
      const startRes = await request(app).post(`/api/v1/labs/${linuxLabId}/sessions`);
      expect(startRes.status).toBe(401);

      const execRes = await request(app)
        .post('/api/v1/labs/sessions/dummy-id/execute')
        .send({ command: 'pwd' });
      expect(execRes.status).toBe(401);

      const endRes = await request(app).post('/api/v1/labs/sessions/dummy-id/end');
      expect(endRes.status).toBe(401);

      const mySessRes = await request(app).get('/api/v1/labs/my-sessions');
      expect(mySessRes.status).toBe(401);
    });

    it('SECURITY CHECK: Cannot execute commands on an already COMPLETED session (400 Bad Request)', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);
      const sessId = startRes.body.data.session.id;

      // End session
      await request(app)
        .post(`/api/v1/labs/sessions/${sessId}/end`)
        .set('Cookie', studentCookie);

      // Attempt to execute command on closed session
      const execRes = await request(app)
        .post(`/api/v1/labs/sessions/${sessId}/execute`)
        .set('Cookie', studentCookie)
        .send({ command: 'pwd' });

      expect(execRes.status).toBe(400);
      expect(execRes.body.success).toBe(false);
      expect(execRes.body.message).toContain('already closed');
    });
  });

  describe('10. CodeEditor Buffer Execution API & Validation', () => {
    it('executes modified Python and JavaScript buffers through /execute and validates input', async () => {
      const labsRes = await request(app)
        .get('/api/v1/labs?category=PROGRAMMING')
        .set('Cookie', studentCookie);
      expect(labsRes.status).toBe(200);
      const progLab = labsRes.body.data.labs[0];
      expect(progLab).toBeDefined();

      const startRes = await request(app)
        .post(`/api/v1/labs/${progLab.id}/sessions`)
        .set('Cookie', studentCookie);
      expect([200, 201]).toContain(startRes.status);
      const progSessionId = startRes.body.data.session.id;

      // 1. Execute custom Python buffer
      const pyRes = await request(app)
        .post(`/api/v1/labs/sessions/${progSessionId}/execute`)
        .set('Cookie', studentCookie)
        .send({
          command: 'python3 app.py',
          code: 'x = 15\ny = 27\nprint(x + y)',
          language: 'python',
        });
      expect(pyRes.status).toBe(200);
      expect(pyRes.body.data.output).toBe('42');

      // 2. Execute custom JavaScript buffer
      const jsRes = await request(app)
        .post(`/api/v1/labs/sessions/${progSessionId}/execute`)
        .set('Cookie', studentCookie)
        .send({
          command: 'node index.js',
          code: 'const tag = "Phase9D";\nconsole.log(`Editor ${tag}`);',
          language: 'javascript',
        });
      expect(jsRes.status).toBe(200);
      expect(jsRes.body.data.output).toBe('Editor Phase9D');

      // 3. Reject invalid language enum
      const badLangRes = await request(app)
        .post(`/api/v1/labs/sessions/${progSessionId}/execute`)
        .set('Cookie', studentCookie)
        .send({
          command: 'python3 app.py',
          code: 'print(1)',
          language: 'ruby',
        });
      expect(badLangRes.status).toBe(400);

      // 4. Reject oversized code buffer (>10000 chars)
      const hugeRes = await request(app)
        .post(`/api/v1/labs/sessions/${progSessionId}/execute`)
        .set('Cookie', studentCookie)
        .send({
          command: 'python3 app.py',
          code: 'a = 1\n'.repeat(2500),
          language: 'python',
        });
      expect(hugeRes.status).toBe(400);
    });
  });

  describe('11. Phase 9F.1: Redis Simulator State Persistence, TTL, Fallback & Cleanup', () => {
    it('persists Linux VFS and SQL state in Redis across in-memory restarts', async () => {
      const mockRedis = new RedisMock();
      redisService.setClient(mockRedis);

      try {
        const linuxSessId = 'redis-vfs-sess-1';
        const dbSessId = 'redis-db-sess-1';

        // Mutate Linux VFS and persist to Redis
        await LabSimulatorService.execute(linuxSessId, 'LINUX', 'mkdir project_alpha');
        await LabSimulatorService.execute(linuxSessId, 'LINUX', 'cd project_alpha');
        await LabSimulatorService.execute(linuxSessId, 'LINUX', 'touch notes.txt');
        await LabSimulatorService.execute(linuxSessId, 'LINUX', 'cd ..');

        // Simulate process restart by clearing local in-memory map
        LabSimulatorService.clearInMemoryStore();
        expect(LabSimulatorService.hasInMemoryState(linuxSessId)).toBe(false);

        // Verify Linux VFS state is restored from Redis (both ls and tabComplete)
        const lsRes = await LabSimulatorService.execute(linuxSessId, 'LINUX', 'ls project_alpha');
        expect(lsRes.output).toContain('notes.txt');

        const tabRes = await LabSimulatorService.tabComplete(linuxSessId, 'LINUX', 'ls project_alpha/no');
        expect(tabRes.completedLine).toBe('ls project_alpha/notes.txt ');

        // Mutate SQL state and persist to Redis
        await LabSimulatorService.execute(
          dbSessId,
          'DATABASE',
          "INSERT INTO students (name, email, gpa, department) VALUES ('Zoe', 'zoe@edu', 3.9, 'CS');"
        );
        LabSimulatorService.clearInMemoryStore();

        const sqlRes = await LabSimulatorService.execute(dbSessId, 'DATABASE', 'SELECT * FROM students;');
        expect(sqlRes.output).toContain('David Miller');
        expect(sqlRes.output).toContain('(4 rows)');
      } finally {
        await mockRedis.flushall();
        redisService.resetClient();
        LabSimulatorService.clearInMemoryStore();
      }
    });

    it('falls back to in-memory store when Redis is unavailable and respects TTL expiration', async () => {
      redisService.resetClient();
      LabSimulatorService.clearInMemoryStore();

      const sessId = 'fallback-ttl-sess';
      await LabSimulatorService.execute(sessId, 'LINUX', 'mkdir fallback_dir', undefined, undefined, 1);
      expect(LabSimulatorService.hasInMemoryState(sessId)).toBe(true);

      const lsBeforeExpire = await LabSimulatorService.execute(
        sessId,
        'LINUX',
        'ls',
        undefined,
        undefined,
        1
      );
      expect(lsBeforeExpire.output).toContain('fallback_dir');

      // Wait for 1-second TTL to expire in-memory fallback
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(LabSimulatorService.hasInMemoryState(sessId)).toBe(false);

      const lsAfterExpire = await LabSimulatorService.execute(sessId, 'LINUX', 'ls');
      expect(lsAfterExpire.output).not.toContain('fallback_dir');
      LabSimulatorService.clearInMemoryStore();
    });

    it('cleans up simulator state on endSession without affecting another student session', async () => {
      const mockRedis = new RedisMock();
      redisService.setClient(mockRedis);

      try {
        // Student A starts a session and mutates VFS
        const sessARes = await request(app)
          .post(`/api/v1/labs/${linuxLabId}/sessions`)
          .set('Cookie', studentCookie);
        const sessAId = sessARes.body.data.session.id;

        // Student B starts an independent session and mutates VFS
        const sessBRes = await request(app)
          .post(`/api/v1/labs/${linuxLabId}/sessions`)
          .set('Cookie', otherStudentCookie);
        const sessBId = sessBRes.body.data.session.id;

        await request(app)
          .post(`/api/v1/labs/sessions/${sessAId}/execute`)
          .set('Cookie', studentCookie)
          .send({ command: 'mkdir student_a_dir' });

        await request(app)
          .post(`/api/v1/labs/sessions/${sessBId}/execute`)
          .set('Cookie', otherStudentCookie)
          .send({ command: 'mkdir student_b_dir' });

        expect(await redisService.exists(`sim:session:${sessAId}`)).toBe(true);
        expect(await redisService.exists(`sim:session:${sessBId}`)).toBe(true);

        // Student A ends their session
        const endARes = await request(app)
          .post(`/api/v1/labs/sessions/${sessAId}/end`)
          .set('Cookie', studentCookie);
        expect(endARes.status).toBe(200);

        // Student A's Redis & in-memory state are cleaned up; Student B's state remains intact
        expect(await redisService.exists(`sim:session:${sessAId}`)).toBe(false);
        expect(LabSimulatorService.hasInMemoryState(sessAId)).toBe(false);
        expect(await redisService.exists(`sim:session:${sessBId}`)).toBe(true);

        const verifyBRes = await request(app)
          .post(`/api/v1/labs/sessions/${sessBId}/execute`)
          .set('Cookie', otherStudentCookie)
          .send({ command: 'ls' });
        expect(verifyBRes.status).toBe(200);
        expect(verifyBRes.body.data.output).toContain('student_b_dir');
      } finally {
        await mockRedis.flushall();
        redisService.resetClient();
        LabSimulatorService.clearInMemoryStore();
      }
    });
  });
});
