// Kuro: HTTP handlers for Netflix-style profiles + watch history.
//
// All routes are server-state CRUD over SQLite (the same DB the rest of seanime
// uses). The frontend sends a client-generated UUID as the `uid` so a profile
// switch is instantaneous (no round-trip needed to read back an auto-id).
package handlers

import (
	"seanime/internal/database/models"
	"strconv"

	"github.com/labstack/echo/v4"
)

// HandleListKuroProfiles
//
//	@summary returns all profiles ordered by creation date.
//	@route /api/v1/kuro-profiles [GET]
//	@returns []models.KuroProfile
func (h *Handler) HandleListKuroProfiles(c echo.Context) error {
	profiles, err := h.App.Database.ListKuroProfiles()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if profiles == nil {
		profiles = []*models.KuroProfile{}
	}
	return h.RespondWithData(c, profiles)
}

// HandleCreateKuroProfile
//
//	@summary creates a new profile.
//	@route /api/v1/kuro-profiles [POST]
//	@returns models.KuroProfile
func (h *Handler) HandleCreateKuroProfile(c echo.Context) error {
	var body struct {
		UID    string `json:"uid"`
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
		Color  string `json:"color"`
	}
	if err := c.Bind(&body); err != nil {
		return h.RespondWithError(c, err)
	}

	created, err := h.App.Database.CreateKuroProfile(&models.KuroProfile{
		UID:    body.UID,
		Name:   body.Name,
		Avatar: body.Avatar,
		Color:  body.Color,
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, created)
}

// HandleUpdateKuroProfile
//
//	@summary patches a profile's mutable fields.
//	@route /api/v1/kuro-profiles/{uid} [PATCH]
//	@returns models.KuroProfile
func (h *Handler) HandleUpdateKuroProfile(c echo.Context) error {
	uid := c.Param("uid")
	var body struct {
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
		Color  string `json:"color"`
	}
	if err := c.Bind(&body); err != nil {
		return h.RespondWithError(c, err)
	}
	updated, err := h.App.Database.UpdateKuroProfile(uid, body.Name, body.Avatar, body.Color)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, updated)
}

// HandleDeleteKuroProfile
//
//	@summary removes a profile and its watch history.
//	@route /api/v1/kuro-profiles/{uid} [DELETE]
//	@returns bool
func (h *Handler) HandleDeleteKuroProfile(c echo.Context) error {
	uid := c.Param("uid")
	if err := h.App.Database.DeleteKuroProfile(uid); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

// HandleListKuroProfileHistory
//
//	@summary returns the watch history for a profile, most-recent first.
//	@route /api/v1/kuro-profiles/{uid}/history [GET]
//	@returns []models.KuroProfileWatchHistory
func (h *Handler) HandleListKuroProfileHistory(c echo.Context) error {
	uid := c.Param("uid")
	items, err := h.App.Database.ListKuroProfileWatchHistory(uid)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if items == nil {
		items = []*models.KuroProfileWatchHistory{}
	}
	return h.RespondWithData(c, items)
}

// HandleUpsertKuroProfileHistoryItem
//
//	@summary inserts or updates a single (profile, media) watch entry.
//	@route /api/v1/kuro-profiles/{uid}/history [PUT]
//	@returns models.KuroProfileWatchHistory
func (h *Handler) HandleUpsertKuroProfileHistoryItem(c echo.Context) error {
	uid := c.Param("uid")
	var body struct {
		MediaID       int     `json:"mediaId"`
		EpisodeNumber int     `json:"episodeNumber"`
		CurrentTime   float64 `json:"currentTime"`
		Duration      float64 `json:"duration"`
	}
	if err := c.Bind(&body); err != nil {
		return h.RespondWithError(c, err)
	}
	saved, err := h.App.Database.UpsertKuroProfileWatchHistoryItem(&models.KuroProfileWatchHistory{
		ProfileUID:    uid,
		MediaID:       body.MediaID,
		EpisodeNumber: body.EpisodeNumber,
		CurrentTime:   body.CurrentTime,
		Duration:      body.Duration,
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, saved)
}

// HandleDeleteKuroProfileHistoryItem
//
//	@summary removes ALL watch entries for a (profile, media) pair (i.e. the
//	         whole series, every episode).
//	@route /api/v1/kuro-profiles/{uid}/history/{mediaId} [DELETE]
//	@returns bool
func (h *Handler) HandleDeleteKuroProfileHistoryItem(c echo.Context) error {
	uid := c.Param("uid")
	mediaID, err := strconv.Atoi(c.Param("mediaId"))
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if err := h.App.Database.DeleteKuroProfileWatchHistoryItem(uid, mediaID); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

// HandleDeleteKuroProfileHistoryEpisode
//
//	@summary removes a single watched-episode row.
//	@route /api/v1/kuro-profiles/{uid}/history/{mediaId}/episode/{episodeNumber} [DELETE]
//	@returns bool
func (h *Handler) HandleDeleteKuroProfileHistoryEpisode(c echo.Context) error {
	uid := c.Param("uid")
	mediaID, err := strconv.Atoi(c.Param("mediaId"))
	if err != nil {
		return h.RespondWithError(c, err)
	}
	episodeNumber, err := strconv.Atoi(c.Param("episodeNumber"))
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if err := h.App.Database.DeleteKuroProfileWatchHistoryEpisode(uid, mediaID, episodeNumber); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

// HandleClearKuroProfileHistory
//
//	@summary wipes every history row for a profile (full reset).
//	@route /api/v1/kuro-profiles/{uid}/history [DELETE]
//	@returns bool
func (h *Handler) HandleClearKuroProfileHistory(c echo.Context) error {
	uid := c.Param("uid")
	if err := h.App.Database.ClearKuroProfileWatchHistory(uid); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

// HandleUpsertKuroProfileHistoryItemPOST is the POST alias for the upsert
// endpoint. The browser's `navigator.sendBeacon` (used by the watch page on
// pagehide / visibility change) only ever fires POST, so we accept it here
// alongside PUT.
func (h *Handler) HandleUpsertKuroProfileHistoryItemPOST(c echo.Context) error {
	return h.HandleUpsertKuroProfileHistoryItem(c)
}

// -----------------------------------------------------------------------------
// Per-profile list (the "Mes listes" view, isolated per profile)
// -----------------------------------------------------------------------------

// HandleListKuroProfileList
//
//	@summary returns the profile's list entries (one row per (profile, media)).
//	@route /api/v1/kuro-profiles/{uid}/list [GET]
//	@returns []models.KuroProfileListEntry
func (h *Handler) HandleListKuroProfileList(c echo.Context) error {
	uid := c.Param("uid")
	entries, err := h.App.Database.ListKuroProfileListEntries(uid)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if entries == nil {
		entries = []*models.KuroProfileListEntry{}
	}
	return h.RespondWithData(c, entries)
}

// HandleUpsertKuroProfileListEntry
//
//	@summary inserts or updates the (profile, media) list row.
//	@route /api/v1/kuro-profiles/{uid}/list [PUT]
//	@returns models.KuroProfileListEntry
func (h *Handler) HandleUpsertKuroProfileListEntry(c echo.Context) error {
	uid := c.Param("uid")
	var body struct {
		MediaID int    `json:"mediaId"`
		Status  string `json:"status"`
	}
	if err := c.Bind(&body); err != nil {
		return h.RespondWithError(c, err)
	}
	saved, err := h.App.Database.UpsertKuroProfileListEntry(&models.KuroProfileListEntry{
		ProfileUID: uid,
		MediaID:    body.MediaID,
		Status:     body.Status,
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, saved)
}

// HandleDeleteKuroProfileListEntry
//
//	@summary removes one media from this profile's list (does not touch AniList).
//	@route /api/v1/kuro-profiles/{uid}/list/{mediaId} [DELETE]
//	@returns bool
func (h *Handler) HandleDeleteKuroProfileListEntry(c echo.Context) error {
	uid := c.Param("uid")
	mediaID, err := strconv.Atoi(c.Param("mediaId"))
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if err := h.App.Database.DeleteKuroProfileListEntry(uid, mediaID); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}
