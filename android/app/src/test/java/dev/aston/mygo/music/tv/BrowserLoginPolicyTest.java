package dev.aston.mygo.music.tv;
import org.junit.Test;
import static org.junit.Assert.*;
public final class BrowserLoginPolicyTest {
 @Test public void onlySecurePagesAndExactCallbackAreAllowed(){
  assertTrue(BrowserLoginPolicy.allowed("https://accounts.example.com/auth",""));
  for(String u:new String[]{"http://example.com","file:///a","javascript:alert(1)","intent://a","https://user:pass@example.com","https://127.0.0.1/api/login","https://localhost","https://[::1]"})assertFalse(u,BrowserLoginPolicy.allowed(u,""));
  String expected="http://127.0.0.1:4444/cb";
  assertTrue(BrowserLoginPolicy.allowed(expected+"?code=abc",expected));
  assertFalse(BrowserLoginPolicy.allowed("http://127.0.0.1:4445/cb?code=abc",expected));
  assertFalse(BrowserLoginPolicy.allowed("http://127.0.0.1:4444/api/login?code=abc",expected));
  assertFalse(BrowserLoginPolicy.allowed(expected,expected));
 }
 @Test public void allRequiredCookiesMustHaveValues(){
  String[] required={"SID","HSID"};
  assertTrue(BrowserLoginPolicy.complete("SID=a; HSID=b",required));
  for(String v:new String[]{"OTHER=a; SID=x","SID=a; HSID=","SID=a\r\nHSID=b","SID=a; xHSID=b"})assertFalse(BrowserLoginPolicy.complete(v,required));
 }
}
