.PHONY: build up down restart logs ps health migrate migrate-status deploy update prune clean

COMPOSE = docker compose --env-file .env.production

## Build the production image (no cache)
build:
	$(COMPOSE) build --no-cache

## Start the app in the background
up:
	$(COMPOSE) up -d

## Stop and remove the app container
down:
	$(COMPOSE) down

## Restart the running container (no rebuild)
restart:
	$(COMPOSE) restart

## Follow container logs
logs:
	$(COMPOSE) logs -f app

## Show container status
ps:
	docker ps --filter "name=nextjs-frontend"

## Curl the health endpoint
health:
	curl -fsS http://localhost:3002/api/health && echo

## Apply pending Prisma migrations against DATABASE_URL in .env.production
migrate:
	$(COMPOSE) run --rm migrate migrate deploy

## Show Prisma migration status without applying anything
migrate-status:
	$(COMPOSE) run --rm migrate migrate status

## Full deploy: pull latest code, rebuild, migrate, restart with near-zero downtime
deploy:
	git pull
	$(COMPOSE) build --no-cache
	$(MAKE) migrate
	$(COMPOSE) up -d --no-deps --build app
	$(MAKE) health

## Same as deploy but skips the git pull (use when you already have the code you want)
update:
	$(COMPOSE) build --no-cache
	$(MAKE) migrate
	$(COMPOSE) up -d --no-deps --build app
	$(MAKE) health

## Remove dangling images from previous builds
prune:
	docker image prune -f

## Remove all unused Docker data (images, containers, networks, build cache)
clean:
	docker system prune -f
