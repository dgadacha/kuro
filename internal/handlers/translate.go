package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

// In-process cache. Keyed by sha256(text|target). Loses contents on restart.
type translateCacheEntry struct {
	value    string
	expires  time.Time
}

var (
	translateCache   = make(map[string]translateCacheEntry)
	translateCacheMu sync.RWMutex
	translateClient  = &http.Client{Timeout: 15 * time.Second}
)

const translateCacheTTL = 30 * 24 * time.Hour

func translateCacheKey(text, target string) string {
	h := sha256.Sum256([]byte(text + "|" + target))
	return hex.EncodeToString(h[:])
}

// HandleTranslateText
//
//	@summary proxies a single translation request to DeepL Free / Pro.
//	@desc The API key is sent per-request (stored in the browser's
//	      localStorage by the frontend, never in the server config).
//	      Translations are cached in-memory by sha256(text|target) for
//	      30 days, so re-opening the same anime is free.
//	@route /api/v1/translate [POST]
//	@returns {translated string}
func (h *Handler) HandleTranslateText(c echo.Context) error {
	type body struct {
		Text   string `json:"text"`
		Target string `json:"target"`
		Key    string `json:"key"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, fmt.Errorf("invalid body: %w", err))
	}
	b.Text = strings.TrimSpace(b.Text)
	b.Target = strings.ToUpper(strings.TrimSpace(b.Target))
	b.Key = strings.TrimSpace(b.Key)

	if b.Text == "" || b.Target == "" {
		return h.RespondWithData(c, map[string]string{"translated": ""})
	}
	if b.Key == "" {
		return h.RespondWithError(c, fmt.Errorf("missing DeepL API key"))
	}

	// Cache
	cacheKey := translateCacheKey(b.Text, b.Target)
	translateCacheMu.RLock()
	if e, ok := translateCache[cacheKey]; ok && time.Now().Before(e.expires) {
		translateCacheMu.RUnlock()
		return h.RespondWithData(c, map[string]string{"translated": e.value})
	}
	translateCacheMu.RUnlock()

	// Free-tier keys end in ":fx" → api-free.deepl.com, otherwise api.deepl.com.
	host := "api.deepl.com"
	if strings.HasSuffix(b.Key, ":fx") {
		host = "api-free.deepl.com"
	}

	form := url.Values{}
	form.Set("text", b.Text)
	form.Set("target_lang", b.Target)
	form.Set("preserve_formatting", "1")

	req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodPost,
		"https://"+host+"/v2/translate", strings.NewReader(form.Encode()))
	if err != nil {
		return h.RespondWithError(c, err)
	}
	req.Header.Set("Authorization", "DeepL-Auth-Key "+b.Key)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "kuro/1.0")

	resp, err := translateClient.Do(req)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return h.RespondWithError(c, fmt.Errorf("deepl returned %d: %s", resp.StatusCode, string(body)))
	}

	var parsed struct {
		Translations []struct {
			Text string `json:"text"`
		} `json:"translations"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return h.RespondWithError(c, err)
	}

	out := ""
	if len(parsed.Translations) > 0 {
		out = parsed.Translations[0].Text
	}

	translateCacheMu.Lock()
	translateCache[cacheKey] = translateCacheEntry{value: out, expires: time.Now().Add(translateCacheTTL)}
	translateCacheMu.Unlock()

	return h.RespondWithData(c, map[string]string{"translated": out})
}
