-- =============================================
-- Stackable Badges & Learning Paths
-- =============================================

USE CEPBadges;
GO

-- Add columns to badge_classes
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('badge_classes') AND name = 'related_badges')
BEGIN
    ALTER TABLE badge_classes ADD related_badges NVARCHAR(MAX) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('badge_classes') AND name = 'learning_path_order')
BEGIN
    ALTER TABLE badge_classes ADD learning_path_order INT NULL;
END
GO

-- Learning Paths
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'learning_paths')
BEGIN
    CREATE TABLE learning_paths (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        issuer_id   UNIQUEIDENTIFIER NOT NULL,
        name        NVARCHAR(255)    NOT NULL,
        description NVARCHAR(MAX)    NULL,
        is_active   BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_learning_paths PRIMARY KEY (id),
        CONSTRAINT FK_learning_paths_issuer FOREIGN KEY (issuer_id)
            REFERENCES issuers (id)
    );
END
GO

-- Learning Path Badges (junction table with order)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'learning_path_badges')
BEGIN
    CREATE TABLE learning_path_badges (
        id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        learning_path_id UNIQUEIDENTIFIER NOT NULL,
        badge_class_id   UNIQUEIDENTIFIER NOT NULL,
        order_position   INT              NOT NULL DEFAULT 0,
        is_required      BIT              NOT NULL DEFAULT 1,

        CONSTRAINT PK_learning_path_badges PRIMARY KEY (id),
        CONSTRAINT FK_lpb_path FOREIGN KEY (learning_path_id)
            REFERENCES learning_paths (id),
        CONSTRAINT FK_lpb_badge FOREIGN KEY (badge_class_id)
            REFERENCES badge_classes (id),
        CONSTRAINT UQ_lpb_path_badge UNIQUE (learning_path_id, badge_class_id)
    );
END
GO

CREATE NONCLUSTERED INDEX IX_lpb_path ON learning_path_badges (learning_path_id, order_position);
GO

PRINT '✓ Stackable badges and learning paths tables created.';
GO
