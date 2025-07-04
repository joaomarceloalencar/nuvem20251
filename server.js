const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Inicializar banco de dados SQLite
const dbPath = path.join(__dirname, 'todolist.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar com o banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco SQLite.');
        initializeDatabase();
    }
});

// Criar tabela se não existir
function initializeDatabase() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    db.run(createTableQuery, (err) => {
        if (err) {
            console.error('Erro ao criar tabela:', err.message);
        } else {
            console.log('Tabela "tasks" criada ou já existe.');
        }
    });
}

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===== ROTAS DA API =====

// GET /api/tasks - Listar todas as tarefas
app.get('/api/tasks', (req, res) => {
    const { filter } = req.query;
    let query = 'SELECT * FROM tasks ORDER BY created_at DESC';
    
    if (filter === 'pending') {
        query = 'SELECT * FROM tasks WHERE completed = 0 ORDER BY created_at DESC';
    } else if (filter === 'completed') {
        query = 'SELECT * FROM tasks WHERE completed = 1 ORDER BY created_at DESC';
    }

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar tarefas:', err.message);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else {
            // Converter completed de 0/1 para boolean
            const tasks = rows.map(row => ({
                ...row,
                completed: Boolean(row.completed),
                createdAt: row.created_at,
                completedAt: row.completed_at,
                updatedAt: row.updated_at
            }));
            res.json(tasks);
        }
    });
});

// POST /api/tasks - Criar nova tarefa
app.post('/api/tasks', (req, res) => {
    const { text } = req.body;

    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Texto da tarefa é obrigatório' });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const now = new Date().toISOString();

    const query = `
        INSERT INTO tasks (id, text, completed, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
    `;

    db.run(query, [id, text.trim(), now, now], function(err) {
        if (err) {
            console.error('Erro ao criar tarefa:', err.message);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else {
            // Buscar a tarefa criada para retornar
            db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: 'Erro ao buscar tarefa criada' });
                } else {
                    const task = {
                        ...row,
                        completed: Boolean(row.completed),
                        createdAt: row.created_at,
                        completedAt: row.completed_at,
                        updatedAt: row.updated_at
                    };
                    res.status(201).json(task);
                }
            });
        }
    });
});

// PUT /api/tasks/:id - Atualizar tarefa
app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { text, completed } = req.body;

    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Texto da tarefa é obrigatório' });
    }

    const now = new Date().toISOString();
    const completedAt = completed ? now : null;

    const query = `
        UPDATE tasks 
        SET text = ?, completed = ?, completed_at = ?, updated_at = ?
        WHERE id = ?
    `;

    db.run(query, [text.trim(), completed ? 1 : 0, completedAt, now, id], function(err) {
        if (err) {
            console.error('Erro ao atualizar tarefa:', err.message);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Tarefa não encontrada' });
        } else {
            // Buscar a tarefa atualizada
            db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
                if (err) {
                    res.status(500).json({ error: 'Erro ao buscar tarefa atualizada' });
                } else {
                    const task = {
                        ...row,
                        completed: Boolean(row.completed),
                        createdAt: row.created_at,
                        completedAt: row.completed_at,
                        updatedAt: row.updated_at
                    };
                    res.json(task);
                }
            });
        }
    });
});

// PATCH /api/tasks/:id/toggle - Alternar status da tarefa
app.patch('/api/tasks/:id/toggle', (req, res) => {
    const { id } = req.params;

    // Primeiro, buscar o status atual
    db.get('SELECT completed FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Erro ao buscar tarefa:', err.message);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else if (!row) {
            res.status(404).json({ error: 'Tarefa não encontrada' });
        } else {
            const newCompleted = !Boolean(row.completed);
            const now = new Date().toISOString();
            const completedAt = newCompleted ? now : null;

            const query = `
                UPDATE tasks 
                SET completed = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
            `;

            db.run(query, [newCompleted ? 1 : 0, completedAt, now, id], function(err) {
                if (err) {
                    console.error('Erro ao alternar tarefa:', err.message);
                    res.status(500).json({ error: 'Erro interno do servidor' });
                } else {
                    // Buscar a tarefa atualizada
                    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
                        if (err) {
                            res.status(500).json({ error: 'Erro ao buscar tarefa atualizada' });
                        } else {
                            const task = {
                                ...row,
                                completed: Boolean(row.completed),
                                createdAt: row.created_at,
                                completedAt: row.completed_at,
                                updatedAt: row.updated_at
                            };
                            res.json(task);
                        }
                    });
                }
            });
        }
    });
});

// DELETE /api/tasks/:id - Deletar tarefa
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM tasks WHERE id = ?';

    db.run(query, [id], function(err) {
        if (err) {
            console.error('Erro ao deletar tarefa:', err.message);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Tarefa não encontrada' });
        } else {
            res.status(204).send(); // No Content
        }
    });
});

// DELETE /api/tasks - Deletar múltiplas tarefas
app.delete('/api/tasks', (req, res) => {
    const { filter } = req.query;
    let query = 'DELETE FROM tasks';

    if (filter === 'completed') {
        query = 'DELETE FROM tasks WHERE completed = 1';
    } else if (filter === 'all') {
        query = 'DELETE FROM tasks';
    } else {
        return res.status(400).json({ error: 'Filtro inválido. Use "completed" ou "all"' });
    }

    db.run(query, [], function(err) {
        if (err) {
            console.error('Erro ao deletar tarefas:', err.message);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else {
            res.json({ deletedCount: this.changes });
        }
    });
});

// GET /api/stats - Estatísticas das tarefas
app.get('/api/stats', (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total FROM tasks',
        'SELECT COUNT(*) as completed FROM tasks WHERE completed = 1',
        'SELECT COUNT(*) as pending FROM tasks WHERE completed = 0'
    ];

    Promise.all(queries.map(query => {
        return new Promise((resolve, reject) => {
            db.get(query, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }))
    .then(results => {
        res.json({
            total: results[0].total,
            completed: results[1].completed,
            pending: results[2].pending
        });
    })
    .catch(err => {
        console.error('Erro ao buscar estatísticas:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    });
});

// GET /api/export - Exportar dados
app.get('/api/export', (req, res) => {
    db.all('SELECT * FROM tasks ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error('Erro ao exportar dados:', err.message);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } else {
            const tasks = rows.map(row => ({
                ...row,
                completed: Boolean(row.completed),
                createdAt: row.created_at,
                completedAt: row.completed_at,
                updatedAt: row.updated_at
            }));

            const exportData = {
                tasks,
                exportDate: new Date().toISOString(),
                version: '1.0',
                totalTasks: tasks.length
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="todolist-backup-${new Date().toISOString().split('T')[0]}.json"`);
            res.json(exportData);
        }
    });
});

// POST /api/import - Importar dados
app.post('/api/import', (req, res) => {
    const { tasks, replaceExisting } = req.body;

    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Dados inválidos. Esperado array de tarefas.' });
    }

    const importTasks = async () => {
        try {
            // Se replaceExisting for true, limpar tabela primeiro
            if (replaceExisting) {
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM tasks', [], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Inserir tarefas
            const insertQuery = `
                INSERT INTO tasks (id, text, completed, created_at, completed_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            let importedCount = 0;
            for (const task of tasks) {
                const id = task.id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
                const now = new Date().toISOString();
                
                await new Promise((resolve, reject) => {
                    db.run(insertQuery, [
                        id,
                        task.text,
                        task.completed ? 1 : 0,
                        task.createdAt || task.created_at || now,
                        task.completedAt || task.completed_at || null,
                        task.updatedAt || task.updated_at || now
                    ], (err) => {
                        if (err) reject(err);
                        else {
                            importedCount++;
                            resolve();
                        }
                    });
                });
            }

            res.json({
                message: 'Dados importados com sucesso',
                importedCount,
                totalTasks: tasks.length
            });

        } catch (error) {
            console.error('Erro ao importar dados:', error.message);
            res.status(500).json({ error: 'Erro ao importar dados' });
        }
    };

    importTasks();
});

// Servir arquivos estáticos (frontend)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando servidor...');
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco de dados:', err.message);
        } else {
            console.log('✅ Banco de dados fechado.');
        }
        process.exit(0);
    });
});
