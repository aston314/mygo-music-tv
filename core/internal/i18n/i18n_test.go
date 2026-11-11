package i18n

import "testing"

func TestTraditionalCoreResourcesAndFallback(t *testing.T) {
	old := Language()
	defer SetLanguage(old)
	for key := range zhCN {
		if zhTW[key] == "" {
			t.Errorf("missing traditional resource: %s", key)
		}
	}
	SetLanguage(TraditionalChinese)
	if T("Settings") != "設定" || Count(10000) != "1.0萬" || T("untranslated fallback") != "untranslated fallback" {
		t.Fatal(T("Settings"), Count(10000))
	}
	for _, tag := range []string{"zh-TW", "zh-Hant", "zh-HK", "zh_Hant_TW"} {
		if Resolve(System, []string{tag}) != TraditionalChinese {
			t.Fatal(tag)
		}
	}
	SetLanguage(Chinese)
	if T("Settings") != "设置" {
		t.Fatal(T("Settings"))
	}
}
