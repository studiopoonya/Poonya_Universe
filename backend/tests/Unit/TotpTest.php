<?php

namespace Tests\Unit;

use App\Services\Totp;
use PHPUnit\Framework\TestCase;

class TotpTest extends TestCase
{
    /** RFC 6238 appendix B (SHA1), last 6 digits. Secret = "12345678901234567890" in base32. */
    public function test_matches_rfc_6238_vectors(): void
    {
        $secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

        foreach ([59 => '287082', 1111111109 => '081804', 1234567890 => '005924', 2000000000 => '279037'] as $time => $code) {
            $this->assertSame($code, Totp::code($secret, intdiv($time, 30)));
        }
    }

    public function test_new_secret_is_32_base32_chars(): void
    {
        $this->assertMatchesRegularExpression('/^[A-Z2-7]{32}$/', Totp::newSecret());
    }

    public function test_uri_is_authenticator_compatible(): void
    {
        $uri = Totp::uri('ABC', 'a@b.co', 'Poonya Studio');

        $this->assertStringStartsWith('otpauth://totp/Poonya%20Studio%3Aa%40b.co?', $uri);
        $this->assertStringContainsString('secret=ABC', $uri);
    }
}
