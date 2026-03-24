-- =============================================
-- Open Badges 3.0 Issuer — CEPBadges
-- SQL Server 2022
-- =============================================

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'CEPBadges')
BEGIN
    CREATE DATABASE CEPBadges;
END
GO

USE CEPBadges;
GO

-- =============================================
-- 1. Issuers (Perfil del emisor / Issuer Profile)
-- OB3: https://www.imsglobal.org/spec/ob/v3p0/#profile
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'issuers')
BEGIN
    CREATE TABLE issuers (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        name        NVARCHAR(255)    NOT NULL,
        url         NVARCHAR(500)    NOT NULL,
        email       NVARCHAR(255)    NULL,
        description NVARCHAR(MAX)    NULL,
        image_url   NVARCHAR(500)    NULL,
        is_active   BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_issuers PRIMARY KEY (id)
    );
END
GO

-- =============================================
-- 2. Badge Classes (Definición de badges / Achievement)
-- OB3: https://www.imsglobal.org/spec/ob/v3p0/#achievement
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'badge_classes')
BEGIN
    CREATE TABLE badge_classes (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        issuer_id       UNIQUEIDENTIFIER NOT NULL,
        name            NVARCHAR(255)    NOT NULL,
        description     NVARCHAR(MAX)    NOT NULL,
        image_url       NVARCHAR(500)    NULL,
        criteria_narrative NVARCHAR(MAX) NULL,
        criteria_url    NVARCHAR(500)    NULL,
        achievement_type NVARCHAR(100)   NULL,  -- e.g. 'Diploma', 'Certificate', 'Badge'
        tags            NVARCHAR(MAX)    NULL,   -- JSON array of tags
        is_active       BIT              NOT NULL DEFAULT 1,
        created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_badge_classes PRIMARY KEY (id),
        CONSTRAINT FK_badge_classes_issuer FOREIGN KEY (issuer_id)
            REFERENCES issuers (id)
    );
END
GO

-- =============================================
-- 3. Recipients (Personas que reciben badges)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'recipients')
BEGIN
    CREATE TABLE recipients (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        name        NVARCHAR(255)    NOT NULL,
        email       NVARCHAR(255)    NOT NULL,
        url         NVARCHAR(500)    NULL,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_recipients PRIMARY KEY (id),
        CONSTRAINT UQ_recipients_email UNIQUE (email)
    );
END
GO

-- =============================================
-- 4. Assertions (Credenciales emitidas / OpenBadgeCredential)
-- OB3: https://www.imsglobal.org/spec/ob/v3p0/#openbadgecredential
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'assertions')
BEGIN
    CREATE TABLE assertions (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        badge_class_id  UNIQUEIDENTIFIER NOT NULL,
        recipient_id    UNIQUEIDENTIFIER NOT NULL,
        issued_on       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        expires_at      DATETIME2        NULL,
        revoked         BIT              NOT NULL DEFAULT 0,
        revocation_reason NVARCHAR(500)  NULL,
        evidence_url    NVARCHAR(500)    NULL,
        evidence_narrative NVARCHAR(MAX) NULL,
        created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_assertions PRIMARY KEY (id),
        CONSTRAINT FK_assertions_badge_class FOREIGN KEY (badge_class_id)
            REFERENCES badge_classes (id),
        CONSTRAINT FK_assertions_recipient FOREIGN KEY (recipient_id)
            REFERENCES recipients (id)
    );
END
GO

-- =============================================
-- Índices
-- =============================================
CREATE NONCLUSTERED INDEX IX_badge_classes_issuer_id
    ON badge_classes (issuer_id)
    WHERE is_active = 1;
GO

CREATE NONCLUSTERED INDEX IX_assertions_badge_class_id
    ON assertions (badge_class_id);
GO

CREATE NONCLUSTERED INDEX IX_assertions_recipient_id
    ON assertions (recipient_id);
GO

CREATE NONCLUSTERED INDEX IX_assertions_issued_on
    ON assertions (issued_on DESC);
GO

PRINT '✓ CEPBadges database and tables created successfully.';
GO
