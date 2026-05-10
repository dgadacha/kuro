// Kuro: CRUD for Netflix-style profiles + per-profile watch history.
//
// Two tables, both keyed by a client-friendly string `uid` (uuid). The frontend
// generates the uid client-side and uses it as the stable handle so a profile
// switch doesn't require a round-trip to the server.
package db

import (
	"errors"
	"seanime/internal/database/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// -----------------------------------------------------------------------------
// Profile CRUD
// -----------------------------------------------------------------------------

func (db *Database) ListKuroProfiles() ([]*models.KuroProfile, error) {
	var res []*models.KuroProfile
	err := db.gormdb.Order("created_at ASC").Find(&res).Error
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (db *Database) GetKuroProfileByUID(uid string) (*models.KuroProfile, error) {
	if uid == "" {
		return nil, errors.New("profile uid required")
	}
	var p models.KuroProfile
	err := db.gormdb.Where("uid = ?", uid).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// CreateKuroProfile inserts a new profile. Returns the created row (with auto
// id + timestamps populated).
func (db *Database) CreateKuroProfile(p *models.KuroProfile) (*models.KuroProfile, error) {
	if p == nil {
		return nil, errors.New("profile required")
	}
	if p.UID == "" {
		return nil, errors.New("profile uid required")
	}
	if p.Name == "" {
		return nil, errors.New("profile name required")
	}
	if err := db.gormdb.Create(p).Error; err != nil {
		return nil, err
	}
	return p, nil
}

// UpdateKuroProfile patches the mutable fields of a profile. Returns the
// refreshed row.
func (db *Database) UpdateKuroProfile(uid string, name, avatar, color string) (*models.KuroProfile, error) {
	p, err := db.GetKuroProfileByUID(uid)
	if err != nil {
		return nil, err
	}
	updates := map[string]interface{}{}
	if name != "" {
		updates["name"] = name
	}
	if avatar != "" {
		updates["avatar"] = avatar
	}
	if color != "" {
		updates["color"] = color
	}
	if len(updates) == 0 {
		return p, nil
	}
	if err := db.gormdb.Model(p).Updates(updates).Error; err != nil {
		return nil, err
	}
	return db.GetKuroProfileByUID(uid)
}

// DeleteKuroProfile removes the profile and its watch history in one transaction.
func (db *Database) DeleteKuroProfile(uid string) error {
	if uid == "" {
		return errors.New("profile uid required")
	}
	return db.gormdb.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("profile_uid = ?", uid).Delete(&models.KuroProfileWatchHistory{}).Error; err != nil {
			return err
		}
		return tx.Where("uid = ?", uid).Delete(&models.KuroProfile{}).Error
	})
}

// -----------------------------------------------------------------------------
// Watch history per profile
// -----------------------------------------------------------------------------

func (db *Database) ListKuroProfileWatchHistory(profileUID string) ([]*models.KuroProfileWatchHistory, error) {
	if profileUID == "" {
		return nil, errors.New("profile uid required")
	}
	var res []*models.KuroProfileWatchHistory
	err := db.gormdb.
		Where("profile_uid = ?", profileUID).
		Order("updated_at DESC").
		Find(&res).Error
	if err != nil {
		return nil, err
	}
	return res, nil
}

// UpsertKuroProfileWatchHistoryItem inserts or updates the (profile_uid, media_id)
// row. The composite unique index on those two columns lets us bounce on conflict.
func (db *Database) UpsertKuroProfileWatchHistoryItem(item *models.KuroProfileWatchHistory) (*models.KuroProfileWatchHistory, error) {
	if item == nil {
		return nil, errors.New("item required")
	}
	if item.ProfileUID == "" {
		return nil, errors.New("profile uid required")
	}
	if item.MediaID == 0 {
		return nil, errors.New("media id required")
	}
	err := db.gormdb.
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "profile_uid"}, {Name: "media_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"episode_number",
				"current_time",
				"duration",
				"updated_at",
			}),
		}).
		Create(item).Error
	if err != nil {
		return nil, err
	}
	// Re-fetch so we return the row with up-to-date timestamps.
	var refreshed models.KuroProfileWatchHistory
	if err := db.gormdb.
		Where("profile_uid = ? AND media_id = ?", item.ProfileUID, item.MediaID).
		First(&refreshed).Error; err != nil {
		return nil, err
	}
	return &refreshed, nil
}

func (db *Database) DeleteKuroProfileWatchHistoryItem(profileUID string, mediaID int) error {
	return db.gormdb.
		Where("profile_uid = ? AND media_id = ?", profileUID, mediaID).
		Delete(&models.KuroProfileWatchHistory{}).Error
}
