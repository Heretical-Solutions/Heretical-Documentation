// Non-published extraction fixture.
//
// This file proves that Doxygen extracts a documented C# type and its members
// from source alone. It deliberately derives from a Unity type and imports the
// UnityEngine namespace even though no Unity SDK, assembly, .asmdef, generated
// .csproj, or stub is present. Doxygen is a source scanner, not a compiler, so
// it documents the type and members from the XML doc comments regardless.
//
// Extraction here demonstrates documentation coverage only. It does NOT prove
// that this code compiles, runs, or is Unity-compatible.

using UnityEngine;

namespace Heretical.Documentation.Fixture
{
    /// <summary>
    /// A documented sample widget used only to prove C# API extraction.
    /// </summary>
    /// <remarks>
    /// Lives outside the published product sections. The portal build writes this
    /// fixture to an ignored directory that is never copied into the payload.
    /// </remarks>
    public class SampleWidget : MonoBehaviour
    {
        /// <summary>
        /// The accumulated charge level.
        /// </summary>
        public int charge;

        /// <summary>
        /// Activates the widget by a given amount.
        /// </summary>
        /// <param name="amount">The amount by which to increase the charge.</param>
        /// <returns><see langword="true"/> when the widget holds a positive charge.</returns>
        public bool Activate(int amount)
        {
            charge += amount;
            return charge > 0;
        }
    }
}
