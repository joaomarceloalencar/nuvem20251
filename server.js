require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 33001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Configuração do banco PostgreSQL via .env
const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
});

// Inicializar banco de dados PostgreSQL
async function initializeDatabase() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    try {
        await pool.query(createTableQuery);
        console.log('Tabela "tasks" criada ou já existe.');
    } catch (err) {
        console.error('Erro ao criar tabela:', err.message);
    }
}

initializeDatabase();

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===== ROTAS DA API =====

// GET /api/tasks - Listar todas as tarefas
app.get('/api/tasks', async (req, res) => {
    const { filter } = req.query;
    let query = 'SELECT * FROM tasks ORDER BY created_at DESC';
    if (filter === 'pending') {
        query = 'SELECT * FROM tasks WHERE completed = FALSE ORDER BY created_at DESC';
    } else if (filter === 'completed') {
        query = 'SELECT * FROM tasks WHERE completed = TRUE ORDER BY created_at DESC';
    }
    try {
        const { rows } = await pool.query(query);
        const tasks = rows.map(row => ({
            ...row,
            completed: Boolean(row.completed),
            createdAt: row.created_at,
            completedAt: row.completed_at,
            updatedAt: row.updated_at
        }));
        res.json(tasks);
    } catch (err) {
        console.error('Erro ao buscar tarefas:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST /api/tasks - Criar nova tarefa
app.post('/api/tasks', async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Texto da tarefa é obrigatório' });
    }
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const now = new Date().toISOString();
    const query = `
        INSERT INTO tasks (id, text, completed, created_at, updated_at)
        VALUES ($1, $2, FALSE, $3, $3)
        RETURNING *
    `;
    try {
        const { rows } = await pool.query(query, [id, text.trim(), now]);
        const row = rows[0];
        const task = {
            ...row,
            completed: Boolean(row.completed),
            createdAt: row.created_at,
            completedAt: row.completed_at,
            updatedAt: row.updated_at
        };
        res.status(201).json(task);
    } catch (err) {
        console.error('Erro ao criar tarefa:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT /api/tasks/:id - Atualizar tarefa
app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { text, completed } = req.body;
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Texto da tarefa é obrigatório' });
    }
    const now = new Date().toISOString();
    const completedAt = completed ? now : null;
    const query = `
        UPDATE tasks 
        SET text = $1, completed = $2, completed_at = $3, updated_at = $4
        WHERE id = $5
        RETURNING *
    `;
    try {
        const { rows } = await pool.query(query, [text.trim(), completed, completedAt, now, id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tarefa não encontrada' });
        }
        const row = rows[0];
        const task = {
            ...row,
            completed: Boolean(row.completed),
            createdAt: row.created_at,
            completedAt: row.completed_at,
            updatedAt: row.updated_at
        };
        res.json(task);
    } catch (err) {
        console.error('Erro ao atualizar tarefa:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PATCH /api/tasks/:id/toggle - Alternar status da tarefa
app.patch('/api/tasks/:id/toggle', async (req, res) => {
    const { id } = req.params;
    try {
        // Buscar status atual
        const { rows: currentRows } = await pool.query('SELECT completed FROM tasks WHERE id = $1', [id]);
        if (currentRows.length === 0) {
            return res.status(404).json({ error: 'Tarefa não encontrada' });
        }
        const newCompleted = !currentRows[0].completed;
        const now = new Date().toISOString();
        const completedAt = newCompleted ? now : null;
        const updateQuery = `
            UPDATE tasks 
            SET completed = $1, completed_at = $2, updated_at = $3
            WHERE id = $4
            RETURNING *
        `;
        const { rows } = await pool.query(updateQuery, [newCompleted, completedAt, now, id]);
        const row = rows[0];
        const task = {
            ...row,
            completed: Boolean(row.completed),
            createdAt: row.created_at,
            completedAt: row.completed_at,
            updatedAt: row.updated_at
        };
        res.json(task);
    } catch (err) {
        console.error('Erro ao alternar tarefa:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE /api/tasks/:id - Deletar tarefa
app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM tasks WHERE id = $1';
    try {
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tarefa não encontrada' });
        }
        res.status(204).send();
    } catch (err) {
        console.error('Erro ao deletar tarefa:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE /api/tasks - Deletar múltiplas tarefas
app.delete('/api/tasks', async (req, res) => {
    const { filter } = req.query;
    let query = 'DELETE FROM tasks';
    let params = [];
    if (filter === 'completed') {
        query = 'DELETE FROM tasks WHERE completed = TRUE';
    } else if (filter === 'all') {
        query = 'DELETE FROM tasks';
    } else {
        return res.status(400).json({ error: 'Filtro inválido. Use "completed" ou "all"' });
    }
    try {
        const result = await pool.query(query, params);
        res.json({ deletedCount: result.rowCount });
    } catch (err) {
        console.error('Erro ao deletar tarefas:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/stats - Estatísticas das tarefas
app.get('/api/stats', async (req, res) => {
    const queries = [
        'SELECT COUNT(*) as total FROM tasks',
        'SELECT COUNT(*) as completed FROM tasks WHERE completed = TRUE',
        'SELECT COUNT(*) as pending FROM tasks WHERE completed = FALSE'
    ];
    try {
        const results = await Promise.all(queries.map(q => pool.query(q)));
        res.json({
            total: parseInt(results[0].rows[0].total, 10),
            completed: parseInt(results[1].rows[0].completed, 10),
            pending: parseInt(results[2].rows[0].pending, 10)
        });
    } catch (err) {
        console.error('Erro ao buscar estatísticas:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/export - Exportar dados
app.get('/api/export', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
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
    } catch (err) {
        console.error('Erro ao exportar dados:', err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST /api/import - Importar dados
app.post('/api/import', async (req, res) => {
    const { tasks, replaceExisting } = req.body;
    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Dados inválidos. Esperado array de tarefas.' });
    }
    try {
        if (replaceExisting) {
            await pool.query('DELETE FROM tasks');
        }
        const insertQuery = `
            INSERT INTO tasks (id, text, completed, created_at, completed_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        `;
        let importedCount = 0;
        for (const task of tasks) {
            const id = task.id || (Date.now().toString(36) + Math.random().toString(36).substr(2));
            const now = new Date().toISOString();
            await pool.query(insertQuery, [
                id,
                task.text,
                !!task.completed,
                task.createdAt || task.created_at || now,
                task.completedAt || task.completed_at || null,
                task.updatedAt || task.updated_at || now
            ]);
            importedCount++;
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: http://0.0.0.0:${PORT}`);
    console.log(`🔌 API: http://0.0.0.0:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando servidor...');
    await pool.end();
    console.log('✅ Conexão com banco de dados encerrada.');
    process.exit(0);
});
