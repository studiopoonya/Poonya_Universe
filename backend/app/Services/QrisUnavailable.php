<?php

namespace App\Services;

/** QRIS couldn't be created for a reason the Snap popup may not share (e.g. channel not enabled). */
class QrisUnavailable extends \RuntimeException {}
