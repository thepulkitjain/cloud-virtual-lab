export interface DbSessionState {
  students: Array<{ id: number; name: string; email: string; gpa: number; department: string }>;
  courses: Array<{ id: number; code: string; title: string; credits: number }>;
}

export class DatabaseSimulator {
  static createInitialState(): DbSessionState {
    return {
      students: [
        { id: 1, name: 'Alice Smith', email: 'alice@virtuallab.edu', gpa: 3.8, department: 'Computer Science' },
        { id: 2, name: 'Bob Jones', email: 'bob@virtuallab.edu', gpa: 3.2, department: 'Electrical Engineering' },
        { id: 3, name: 'Catherine Lee', email: 'catherine@virtuallab.edu', gpa: 3.9, department: 'Computer Science' },
      ],
      courses: [
        { id: 101, code: 'CS101', title: 'Intro to Computer Science', credits: 4 },
        { id: 201, code: 'CS201', title: 'Data Structures & Algorithms', credits: 4 },
        { id: 301, code: 'CS301', title: 'Operating Systems & Linux', credits: 3 },
      ],
    };
  }

  static execute(queryStr: string, state: DbSessionState): string {
    const trimmed = queryStr.trim();
    if (!trimmed) return '';

    // Meta commands (psql style)
    if (trimmed === '\\dt' || trimmed === '\\d') {
      return [
        '               List of relations',
        ' Schema |    Name     | Type  |      Owner      ',
        '--------+-------------+-------+-----------------',
        ' public | students    | table | lab_student',
        ' public | courses     | table | lab_student',
        '(2 rows)',
      ].join('\n');
    }

    if (trimmed === '\\l') {
      return [
        '                                  List of databases',
        '       Name        |    Owner    | Encoding |   Collate   |    Ctype    | Access privileges',
        '-------------------+-------------+----------+-------------+-------------+-------------------',
        ' virtual_lab_edu   | lab_student | UTF8     | en_US.UTF-8 | en_US.UTF-8 |',
        '(1 row)',
      ].join('\n');
    }

    if (trimmed.startsWith('\\d ')) {
      const table = trimmed.replace('\\d', '').trim();
      if (table === 'students') {
        return [
          '                                      Table "public.students"',
          '   Column   |          Type          | Collation | Nullable |               Default',
          '------------+------------------------+-----------+----------+--------------------------------------',
          ' id         | integer                |           | not null | nextval(\'students_id_seq\'::regclass)',
          ' name       | character varying(100) |           | not null |',
          ' email      | character varying(150) |           | not null |',
          ' gpa        | numeric(3,2)           |           |          |',
          ' department | character varying(100) |           |          |',
          'Indexes:',
          '    "students_pkey" PRIMARY KEY, btree (id)',
          '    "students_email_key" UNIQUE CONSTRAINT, btree (email)',
        ].join('\n');
      }
      return `Did not find any relation named "${table}".`;
    }

    // SQL Statements
    const normalized = trimmed.replace(/;$/, '').trim();
    const upper = normalized.toUpperCase();

    // 1. SELECT Query
    if (upper.startsWith('SELECT')) {
      if (upper.includes('FROM STUDENTS')) {
        let results = [...state.students];

        // Check for WHERE filter (e.g. gpa > 3.5 or department = 'Computer Science')
        if (upper.includes('WHERE GPA > 3.5') || upper.includes('WHERE GPA>3.5')) {
          results = results.filter((s) => s.gpa > 3.5);
        } else if (upper.includes('WHERE GPA > 3.0') || upper.includes('WHERE GPA>3.0')) {
          results = results.filter((s) => s.gpa > 3.0);
        } else if (upper.includes("WHERE DEPARTMENT = 'COMPUTER SCIENCE'")) {
          results = results.filter((s) => s.department === 'Computer Science');
        }

        const rows = [
          ' id |      name      |          email          | gpa |      department      ',
          '----+----------------+-------------------------+-----+----------------------',
        ];

        results.forEach((s) => {
          rows.push(
            `  ${s.id} | ${s.name.padEnd(14, ' ')} | ${s.email.padEnd(23, ' ')} | ${s.gpa.toFixed(1)} | ${s.department}`
          );
        });

        rows.push(`(${results.length} rows)`);
        return rows.join('\n');
      }

      if (upper.includes('FROM COURSES')) {
        const rows = [
          ' id  |  code  |             title              | credits ',
          '-----+--------+--------------------------------+---------',
        ];
        state.courses.forEach((c) => {
          rows.push(` ${c.id} | ${c.code}  | ${c.title.padEnd(30, ' ')} |    ${c.credits}   `);
        });
        rows.push(`(${state.courses.length} rows)`);
        return rows.join('\n');
      }

      return 'SELECT 1; (Simulated scalar result: 1 row)';
    }

    // 2. INSERT Statement
    if (upper.startsWith('INSERT INTO STUDENTS')) {
      const newId = state.students.length + 1;
      state.students.push({
        id: newId,
        name: 'David Miller',
        email: `david${newId}@virtuallab.edu`,
        gpa: 3.6,
        department: 'Computer Science',
      });
      return 'INSERT 0 1';
    }

    // 3. UPDATE Statement
    if (upper.startsWith('UPDATE STUDENTS')) {
      return 'UPDATE 1';
    }

    // 4. DELETE Statement
    if (upper.startsWith('DELETE FROM STUDENTS')) {
      if (state.students.length > 0) {
        state.students.pop();
        return 'DELETE 1';
      }
      return 'DELETE 0';
    }

    if (upper === 'HELP') {
      return [
        'Educational Database Simulator Commands:',
        '  \\dt                      List public tables',
        '  \\d <table_name>          Describe table structure',
        '  \\l                       List databases',
        '  SELECT * FROM students;  Query all student records',
        '  SELECT * FROM courses;   Query course offerings',
        '  INSERT INTO students ... Insert a new student row',
        '  UPDATE students ...      Update student attributes',
        '  DELETE FROM students ... Remove a student row',
      ].join('\n');
    }

    return `ERROR: syntax error at or near "${trimmed.split(' ')[0]}". Type 'HELP' or '\\dt'.`;
  }
}
