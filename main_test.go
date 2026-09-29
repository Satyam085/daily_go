package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Every feeder in feeders.tsv loads complete, under a subdivision that has a DAS login.
func TestFeedersLoad(t *testing.T) {
	counts := map[string]int{}
	for code, f := range masterDB {
		if f.Name == "" || f.Start == "" || f.End == "" || f.MW == "" {
			t.Errorf("feeder %s has empty fields: %+v", code, f)
		}
		if _, ok := subdivisionCreds[f.Subdivision]; !ok {
			t.Errorf("feeder %s: subdivision %q has no DAS login", code, f.Subdivision)
		}
		counts[f.Subdivision]++
	}
	if counts["Valod"] == 0 || counts["Pipodra"] == 0 {
		t.Errorf("feeders per subdivision = %v, want both Valod and Pipodra", counts)
	}
}

// A feeder from another subdivision (or an unknown code) is rejected before anything is sent to DAS.
func TestRejectsFeederFromOtherSubdivision(t *testing.T) {
	// Point DAS at a fake that fails the test if touched, so a broken check can never file a real report.
	das := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("request reached DAS: %s %s", r.Method, r.URL)
	}))
	defer das.Close()
	realURL := baseURL
	baseURL = das.URL
	defer func() { baseURL = realURL }()

	body := `{"activityDate":"01-01-2026","subdivision":"Valod","rows":[{"Code":"22905","TT":"1"}]}` // 22905 is a Pipodra feeder
	rec := httptest.NewRecorder()
	runScriptHandler(rec, httptest.NewRequest(http.MethodPost, "/api/run-script", strings.NewReader(body)))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "not in subdivision Valod") {
		t.Fatalf("got %d %s, want 400 'not in subdivision Valod'", rec.Code, rec.Body)
	}
}
