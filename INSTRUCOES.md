# Instruções para rodar o projeto com Docker

## Backend

1. **Build da imagem:**

```sh
docker build -f Dockerfile-backend -t todolist-backend .
```

2. **Rodar o container:**

```sh
docker run -d --name todolist-backend -p 3000:3000 todolist-backend
```

Acesse a API em: http://localhost:3000/api

---

## Frontend

1. **Build da imagem:**

```sh
docker build -f Dockerfile-frontend -t todolist-frontend .
```

2. **Rodar o container:**

```sh
docker run -d --name todolist-frontend -p 8080:80 todolist-frontend
```

Acesse o frontend em: http://localhost:8080

---

## Observações
- Certifique-se de que as portas 3000 (backend) e 8080 (frontend) estejam livres.
- Para parar e remover os containers:

```sh
docker stop todolist-backend todolist-frontend

docker rm todolist-backend todolist-frontend
```

- Para ver os logs de um container:

```sh
docker logs <nome-do-container>
```

Qualquer dúvida, consulte este arquivo ou peça ajuda!
