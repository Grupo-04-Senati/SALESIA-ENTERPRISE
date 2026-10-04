-- 0004: foto de perfil en usuarios (espejo de alembic 0004_usuario_avatar).
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "avatar" TEXT NULL;
