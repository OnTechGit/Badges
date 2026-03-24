-- =============================================
-- Admin Users table for JWT authentication
-- =============================================

USE CEPBadges;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'admin_users')
BEGIN
    CREATE TABLE admin_users (
        id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        email         NVARCHAR(255)    NOT NULL,
        password_hash NVARCHAR(255)    NOT NULL,
        created_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_admin_users PRIMARY KEY (id),
        CONSTRAINT UQ_admin_users_email UNIQUE (email)
    );
END
GO

PRINT '✓ admin_users table created successfully.';
GO
