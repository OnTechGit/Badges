-- =============================================
-- Add design_config column to badge_classes
-- =============================================

USE CEPBadges;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('badge_classes') AND name = 'design_config'
)
BEGIN
    ALTER TABLE badge_classes ADD design_config NVARCHAR(MAX) NULL;
END
GO

PRINT '✓ design_config column added to badge_classes.';
GO
