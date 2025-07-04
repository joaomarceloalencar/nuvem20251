// Configuração da API
const API_BASE_URL = 'http://localhost:3000/api';

// Classe principal para gerenciar a lista de tarefas com backend
class TodoList {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.editingTaskId = null;
        this.isOnline = navigator.onLine;
        this.init();
    }

    // Inicializa a aplicação
    async init() {
        this.bindEvents();
        this.setupOnlineStatusMonitoring();
        await this.loadTasks();
        this.render();
        this.updateStats();
        this.showConnectionStatus();
    }

    // Monitora status de conectividade
    setupOnlineStatusMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showConnectionStatus();
            this.syncWithServer();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showConnectionStatus();
        });
    }

    // Mostra status de conexão
    showConnectionStatus() {
        const existingStatus = document.querySelector('.connection-status');
        if (existingStatus) existingStatus.remove();

        if (!this.isOnline) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'connection-status offline';
            statusDiv.innerHTML = `
                <i class="fas fa-wifi"></i>
                <span>Modo Offline - Dados salvos localmente</span>
            `;
            
            Object.assign(statusDiv.style, {
                position: 'fixed',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ffc107',
                color: '#212529',
                padding: '10px 20px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500',
                zIndex: '9998',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            });

            document.body.appendChild(statusDiv);
        }
    }

    // Sincroniza com servidor quando volta online
    async syncWithServer() {
        try {
            await this.loadTasks();
            this.render();
            this.updateStats();
            this.showNotification('Sincronizado com o servidor!', 'success');
        } catch (error) {
            console.error('Erro ao sincronizar:', error);
        }
    }

    // Vincula eventos aos elementos da interface
    bindEvents() {
        // Formulário de adicionar tarefa
        document.getElementById('todo-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Botões de ação
        document.getElementById('clear-completed').addEventListener('click', () => {
            this.showConfirmModal('Deseja remover todas as tarefas concluídas?', () => {
                this.clearCompleted();
            });
        });

        document.getElementById('clear-all').addEventListener('click', () => {
            this.showConfirmModal('Deseja remover TODAS as tarefas?', () => {
                this.clearAll();
            });
        });

        // Modal de confirmação
        document.getElementById('confirm-yes').addEventListener('click', () => {
            this.hideConfirmModal();
            if (this.pendingAction) {
                this.pendingAction();
                this.pendingAction = null;
            }
        });

        document.getElementById('confirm-no').addEventListener('click', () => {
            this.hideConfirmModal();
            this.pendingAction = null;
        });

        // Fechar modal clicando fora
        document.getElementById('confirm-modal').addEventListener('click', (e) => {
            if (e.target.id === 'confirm-modal') {
                this.hideConfirmModal();
            }
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideConfirmModal();
                this.cancelEdit();
            }
        });
    }

    // Faz requisição para a API
    async makeRequest(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const finalOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // Para DELETE que retorna 204 No Content
            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            if (!this.isOnline) {
                throw new Error('Sem conexão com a internet');
            }
            throw error;
        }
    }

    // Carrega tarefas do servidor
    async loadTasks() {
        try {
            this.tasks = await this.makeRequest(`/tasks?filter=${this.currentFilter}`);
        } catch (error) {
            console.error('Erro ao carregar tarefas:', error);
            // Fallback para localStorage em caso de erro
            this.loadTasksFromLocalStorage();
            if (this.isOnline) {
                this.showNotification('Erro ao conectar com o servidor. Usando dados locais.', 'error');
            }
        }
    }

    // Fallback para localStorage
    loadTasksFromLocalStorage() {
        try {
            const saved = localStorage.getItem('todoList');
            this.tasks = saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Erro ao carregar do localStorage:', error);
            this.tasks = [];
        }
    }

    // Salva no localStorage como backup
    saveToLocalStorage() {
        try {
            localStorage.setItem('todoList', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Erro ao salvar no localStorage:', error);
        }
    }

    // Adiciona uma nova tarefa
    async addTask() {
        const input = document.getElementById('todo-input');
        const text = input.value.trim();

        if (!text) return;

        try {
            if (this.editingTaskId) {
                await this.updateTask(this.editingTaskId, text);
            } else {
                const newTask = await this.makeRequest('/tasks', {
                    method: 'POST',
                    body: JSON.stringify({ text })
                });

                this.tasks.unshift(newTask);
                this.saveToLocalStorage();
                this.render();
                this.updateStats();
                this.showNotification('Tarefa adicionada com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Erro ao adicionar tarefa:', error);
            this.showNotification(`Erro: ${error.message}`, 'error');
        }

        input.value = '';
        input.focus();
    }

    // Atualiza uma tarefa existente
    async updateTask(id, newText) {
        try {
            const task = this.tasks.find(t => t.id === id);
            if (!task) return;

            const updatedTask = await this.makeRequest(`/tasks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    text: newText,
                    completed: task.completed 
                })
            });

            // Atualizar na lista local
            const index = this.tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                this.tasks[index] = updatedTask;
            }

            this.saveToLocalStorage();
            this.render();
            this.showNotification('Tarefa atualizada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao atualizar tarefa:', error);
            this.showNotification(`Erro: ${error.message}`, 'error');
        }
        this.cancelEdit();
    }

    // Cancela a edição
    cancelEdit() {
        this.editingTaskId = null;
        const input = document.getElementById('todo-input');
        const addBtn = document.querySelector('.add-btn');
        input.value = '';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
        addBtn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }

    // Inicia a edição de uma tarefa
    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            this.editingTaskId = id;
            const input = document.getElementById('todo-input');
            const addBtn = document.querySelector('.add-btn');
            
            input.value = task.text;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            
            addBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
            addBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        }
    }

    // Alterna o status de conclusão de uma tarefa
    async toggleTask(id) {
        try {
            const updatedTask = await this.makeRequest(`/tasks/${id}/toggle`, {
                method: 'PATCH'
            });

            // Atualizar na lista local
            const index = this.tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                this.tasks[index] = updatedTask;
            }

            this.saveToLocalStorage();
            this.render();
            this.updateStats();
            
            const message = updatedTask.completed ? 'Tarefa concluída!' : 'Tarefa reaberta!';
            this.showNotification(message, 'success');
        } catch (error) {
            console.error('Erro ao alternar tarefa:', error);
            this.showNotification(`Erro: ${error.message}`, 'error');
        }
    }

    // Remove uma tarefa
    async deleteTask(id) {
        this.showConfirmModal('Deseja realmente excluir esta tarefa?', async () => {
            try {
                await this.makeRequest(`/tasks/${id}`, {
                    method: 'DELETE'
                });

                this.tasks = this.tasks.filter(t => t.id !== id);
                this.saveToLocalStorage();
                this.render();
                this.updateStats();
                this.showNotification('Tarefa removida com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao deletar tarefa:', error);
                this.showNotification(`Erro: ${error.message}`, 'error');
            }
        });
    }

    // Define o filtro ativo
    async setFilter(filter) {
        this.currentFilter = filter;
        
        // Atualiza botões de filtro
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        await this.loadTasks();
        this.render();
    }

    // Remove todas as tarefas concluídas
    async clearCompleted() {
        try {
            const result = await this.makeRequest('/tasks?filter=completed', {
                method: 'DELETE'
            });

            this.tasks = this.tasks.filter(t => !t.completed);
            this.saveToLocalStorage();
            this.render();
            this.updateStats();
            this.showNotification(`${result.deletedCount} tarefa(s) concluída(s) removida(s)!`, 'success');
        } catch (error) {
            console.error('Erro ao limpar concluídas:', error);
            this.showNotification(`Erro: ${error.message}`, 'error');
        }
    }

    // Remove todas as tarefas
    async clearAll() {
        try {
            const result = await this.makeRequest('/tasks?filter=all', {
                method: 'DELETE'
            });

            this.tasks = [];
            this.saveToLocalStorage();
            this.render();
            this.updateStats();
            this.showNotification(`${result.deletedCount} tarefa(s) removida(s)!`, 'success');
        } catch (error) {
            console.error('Erro ao limpar todas:', error);
            this.showNotification(`Erro: ${error.message}`, 'error');
        }
    }

    // Renderiza a lista de tarefas
    render() {
        const todoList = document.getElementById('todo-list');
        const emptyState = document.getElementById('empty-state');

        todoList.innerHTML = '';

        if (this.tasks.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        this.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `todo-item ${task.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <input 
                    type="checkbox" 
                    class="todo-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    onchange="todoApp.toggleTask('${task.id}')"
                >
                <span class="todo-text">${this.escapeHtml(task.text)}</span>
                <span class="todo-date">${this.formatDate(task.createdAt || task.created_at)}</span>
                <div class="todo-actions-item">
                    <button class="edit-btn" onclick="todoApp.editTask('${task.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="todoApp.deleteTask('${task.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            todoList.appendChild(li);
        });
    }

    // Atualiza as estatísticas
    async updateStats() {
        try {
            // Tenta buscar estatísticas do servidor
            const stats = await this.makeRequest('/stats');
            document.getElementById('total-tasks').textContent = stats.total;
            document.getElementById('pending-tasks').textContent = stats.pending;
            document.getElementById('completed-tasks').textContent = stats.completed;
        } catch (error) {
            // Fallback para cálculo local
            const total = this.tasks.length;
            const completed = this.tasks.filter(t => t.completed).length;
            const pending = total - completed;

            document.getElementById('total-tasks').textContent = total;
            document.getElementById('pending-tasks').textContent = pending;
            document.getElementById('completed-tasks').textContent = completed;
        }
    }

    // Mostra modal de confirmação
    showConfirmModal(message, action) {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-modal').style.display = 'block';
        this.pendingAction = action;
    }

    // Esconde modal de confirmação
    hideConfirmModal() {
        document.getElementById('confirm-modal').style.display = 'none';
    }

    // Mostra notificação
    showNotification(message, type = 'info') {
        // Remove notificação existente se houver
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Adiciona estilos inline para a notificação
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '9999',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: '500',
            animation: 'slideInRight 0.3s ease',
            maxWidth: '350px',
            wordWrap: 'break-word'
        });

        document.body.appendChild(notification);

        // Remove após 4 segundos (mais tempo para erros)
        const timeout = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, timeout);

        // Permite fechar clicando
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });
    }

    // Formata data para exibição
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Agora';
        if (minutes < 60) return `${minutes}m atrás`;
        if (hours < 24) return `${hours}h atrás`;
        if (days < 7) return `${days}d atrás`;
        
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Escapa HTML para prevenir XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Exporta dados do servidor
    async exportData() {
        try {
            const response = await fetch(`${API_BASE_URL}/export`);
            const blob = await response.blob();
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `todolist-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification('Dados exportados com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao exportar:', error);
            this.showNotification(`Erro ao exportar: ${error.message}`, 'error');
        }
    }

    // Importa dados para o servidor
    async importData(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.tasks || !Array.isArray(data.tasks)) {
                    throw new Error('Formato de arquivo inválido');
                }

                this.showConfirmModal(
                    `Importar ${data.tasks.length} tarefa(s) substituirá a lista atual. Continuar?`, 
                    async () => {
                        try {
                            const result = await this.makeRequest('/import', {
                                method: 'POST',
                                body: JSON.stringify({
                                    tasks: data.tasks,
                                    replaceExisting: true
                                })
                            });

                            await this.loadTasks();
                            this.render();
                            this.updateStats();
                            this.showNotification(
                                `${result.importedCount} tarefa(s) importada(s) com sucesso!`, 
                                'success'
                            );
                        } catch (error) {
                            console.error('Erro ao importar:', error);
                            this.showNotification(`Erro ao importar: ${error.message}`, 'error');
                        }
                    }
                );
            } catch (error) {
                console.error('Erro ao processar arquivo:', error);
                this.showNotification('Erro ao processar arquivo de importação!', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// Adiciona estilos CSS para as notificações e status de conexão
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification {
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    .notification:hover {
        transform: translateX(-5px);
    }

    .connection-status {
        animation: slideInDown 0.3s ease;
    }

    @keyframes slideInDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }

    .todo-item {
        transition: all 0.3s ease;
    }

    .todo-item:hover {
        transform: translateX(5px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }

    /* Loading state */
    .loading {
        opacity: 0.6;
        pointer-events: none;
    }

    .loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        margin: -10px 0 0 -10px;
        border: 2px solid #667eea;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(additionalStyles);

// Inicializa a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoList();
    
    // Adiciona atalhos de teclado adicionais
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter para adicionar tarefa rapidamente
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const input = document.getElementById('todo-input');
            if (input.value.trim()) {
                todoApp.addTask();
            }
        }
        
        // Ctrl/Cmd + E para exportar dados
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            todoApp.exportData();
        }
    });
    
    // Adiciona funcionalidade de arrastar e soltar para importar
    const todoAppElement = document.querySelector('.todo-app');
    
    todoAppElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        todoAppElement.style.borderColor = '#667eea';
        todoAppElement.style.backgroundColor = '#f8f9ff';
    });
    
    todoAppElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
        todoAppElement.style.borderColor = '';
        todoAppElement.style.backgroundColor = '';
    });
    
    todoAppElement.addEventListener('drop', (e) => {
        e.preventDefault();
        todoAppElement.style.borderColor = '';
        todoAppElement.style.backgroundColor = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/json') {
            todoApp.importData(files[0]);
        }
    });
});
