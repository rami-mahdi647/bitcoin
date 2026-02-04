// Copyright (c) 2025 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#include <quantum_virtualbox.h>

#include <chain.h>
#include <kernel/chainparams.h>
#include <logging.h>
#include <util/check.h>
#include <util/string.h>

#include <algorithm>
#include <numeric>
#include <string>
#include <vector>

namespace quantum_virtualbox {
namespace {

constexpr size_t DEFAULT_VIRTUALBOX_COUNT{10000};
constexpr size_t MAX_VIRTUALBOX_COUNT{100000};

size_t ClampVirtualBoxCount(size_t requested)
{
    return std::clamp(requested, size_t{1}, MAX_VIRTUALBOX_COUNT);
}

std::string FormatVirtualBoxId(size_t index)
{
    return strprintf("qvbox-%zu", index);
}

std::vector<std::string> BuildVirtualBoxMesh(size_t count)
{
    std::vector<std::string> mesh;
    mesh.reserve(count);
    for (size_t i = 0; i < count; ++i) {
        mesh.push_back(FormatVirtualBoxId(i));
    }
    return mesh;
}

std::string SummarizeMesh(const std::vector<std::string>& mesh)
{
    if (mesh.empty()) {
        return "<empty>";
    }
    return strprintf("%s..%s", mesh.front(), mesh.back());
}

} // namespace

void ProcessBlock(const CBlock& block, const CBlockIndex& block_index)
{
    const size_t requested_boxes = DEFAULT_VIRTUALBOX_COUNT + block.vtx.size();
    const size_t boxes = ClampVirtualBoxCount(requested_boxes);
    const auto mesh = BuildVirtualBoxMesh(boxes);

    const uint256& block_hash = block_index.GetBlockHash();
    const uint256& prev_hash = block_index.pprev ? block_index.pprev->GetBlockHash() : uint256{};

    const std::string mesh_summary = SummarizeMesh(mesh);

    const uint64_t mesh_checksum = std::accumulate(
        mesh.begin(), mesh.end(), uint64_t{0},
        [](uint64_t acc, const std::string& node) { return acc + node.size(); });

    LogInfo("Quantum VirtualBox mesh: height=%d hash=%s prev=%s boxes=%zu mesh=%s checksum=%u\n",
            block_index.nHeight,
            block_hash.ToString(),
            prev_hash.ToString(),
            boxes,
            mesh_summary,
            mesh_checksum);
}

} // namespace quantum_virtualbox
