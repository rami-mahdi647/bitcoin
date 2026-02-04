// Copyright (c) 2025 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#ifndef BITCOIN_QUANTUM_VIRTUALBOX_H
#define BITCOIN_QUANTUM_VIRTUALBOX_H

#include <primitives/block.h>

class CBlockIndex;

namespace quantum_virtualbox {

void ProcessBlock(const CBlock& block, const CBlockIndex& block_index);

} // namespace quantum_virtualbox

#endif // BITCOIN_QUANTUM_VIRTUALBOX_H
